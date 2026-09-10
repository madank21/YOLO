import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

const DEFAULT_HOST = "http://192.168.43.19:3000";

type Facing = "front" | "back";

interface DetectionObject {
  class_id: number;
  class_name: string;
  confidence: number;
  x1_norm: number;
  y1_norm: number;
  x2_norm: number;
  y2_norm: number;
  track_id?: number;
  is_unknown?: boolean;
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [host, setHost] = useState(DEFAULT_HOST);
  const [pairingCode, setPairingCode] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [facing, setFacing] = useState<Facing>("back");
  const [isStreaming, setIsStreaming] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.15);
  const [status, setStatus] = useState("Enter the host address and pairing code.");
  const [detectedObjects, setDetectedObjects] = useState<DetectionObject[]>([]);
  const [cameraLayout, setCameraLayout] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const cameraRef = useRef<CameraView | null>(null);
  const frameId = useRef(0);
  const isProcessing = useRef(false);

  async function connect() {
    const normalizedHost = host.trim().replace(/\/$/, "");
    if (!normalizedHost || !pairingCode.trim()) {
      setStatus("Enter both the host URL and pairing code.");
      return;
    }

    setStatus("Requesting camera permission...");
    const permissionResult = permission?.granted ? permission : await requestPermission();
    if (!permissionResult.granted) {
      setStatus("Camera permission is required. Tap Allow in the Android permission dialog.");
      return;
    }

    try {
      const response = await fetch(`${normalizedHost}/api/devices/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairing_token: pairingCode.trim(), device_name: "Expo Mobile Camera" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Pairing failed");

      setSessionToken(data.session_token);
      setSessionId(`expo_${Date.now()}`);
      setIsStreaming(true);
      setStatus("Connected. Live camera detection active.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not connect to the host.");
    }
  }

  useEffect(() => {
    if (!isStreaming || !sessionToken || !sessionId) return;
    let active = true;

    const captureAndInfer = async () => {
      if (!active || isProcessing.current) return;
      const camera = cameraRef.current;
      if (!camera) return;

      isProcessing.current = true;
      try {
        const photo = await camera.takePictureAsync({
          base64: true,
          quality: 0.15,
          shutterSound: false,
        });

        if (!photo || !photo.base64) {
          isProcessing.current = false;
          return;
        }

        frameId.current += 1;
        const timestamp = Date.now();
        const rawBase64 = photo.base64.replace(/[\r\n]/g, "");
        const formattedDataUri = rawBase64.startsWith("data:image/")
          ? rawBase64
          : `data:image/jpeg;base64,${rawBase64}`;

        const response = await fetch(`${host.trim().replace(/\/$/, "")}/api/inference/frame`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            type: "frame",
            session_id: sessionId,
            frame_id: frameId.current,
            timestamp,
            format: "jpeg",
            width: photo.width,
            height: photo.height,
            orientation: facing === "front" ? 2 : 1,
            data: formattedDataUri,
            confidence_threshold: confidenceThreshold,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (active) {
            const objects: DetectionObject[] = data.objects || [];
            setDetectedObjects(objects);
            setStatus(`Live • ${objects.length} object(s) detected (${Math.round(confidenceThreshold * 100)}% conf)`);
          }
        } else {
          const errData = await response.json().catch(() => null);
          if (active) {
            setStatus(errData?.error?.message || `Frame error: ${response.status}`);
          }
        }
      } catch (err) {
        if (active) {
          setStatus("Connecting to inference server...");
        }
      } finally {
        isProcessing.current = false;
      }
    };

    const interval = setInterval(captureAndInfer, 40);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [confidenceThreshold, facing, host, isStreaming, sessionId, sessionToken]);

  if (!permission) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>VisionForge Expo Camera</Text>

      {!isStreaming ? (
        <View style={styles.form}>
          <Text style={styles.subtitle}>Native camera client</Text>
          <TextInput
            style={styles.input}
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            placeholder="http://192.168.43.19:3000"
            placeholderTextColor="#64748b"
          />
          <TextInput
            style={styles.input}
            value={pairingCode}
            onChangeText={setPairingCode}
            keyboardType="number-pad"
            placeholder="6-digit pairing code"
            placeholderTextColor="#64748b"
          />
          <Pressable style={styles.primaryButton} onPress={connect}>
            <Text style={styles.buttonText}>Allow Camera & Connect</Text>
          </Pressable>
          <Text style={styles.status}>{status}</Text>
          {!permission.granted && (
            <Text style={styles.hint}>Expo Go will request camera permission when you tap the button.</Text>
          )}
        </View>
      ) : (
        <View style={styles.cameraPanel}>
          <View
            style={styles.cameraContainer}
            onLayout={(e) => setCameraLayout(e.nativeEvent.layout)}
          >
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              animateShutter={false}
            />

            {/* Real-time Bounding Box & Label Overlay */}
            <View
              style={styles.overlayContainer}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0 && (cameraLayout.width !== width || cameraLayout.height !== height)) {
                  setCameraLayout({ width, height });
                }
              }}
            >
              {cameraLayout.width > 0 &&
                cameraLayout.height > 0 &&
                detectedObjects.map((obj, index) => {
                  const x1 = (obj.x1_norm ?? 0) * cameraLayout.width;
                  const y1 = (obj.y1_norm ?? 0) * cameraLayout.height;
                  const boxWidth = Math.max(12, ((obj.x2_norm ?? 0) - (obj.x1_norm ?? 0)) * cameraLayout.width);
                  const boxHeight = Math.max(12, ((obj.y2_norm ?? 0) - (obj.y1_norm ?? 0)) * cameraLayout.height);

                  const isUnknown = obj.is_unknown;
                  const strokeColor = isUnknown ? "#ff3344" : "#00f0ff";
                  const bgColor = isUnknown ? "rgba(255, 51, 68, 0.25)" : "rgba(0, 240, 255, 0.25)";

                  return (
                    <View
                      key={`det-${index}`}
                      pointerEvents="none"
                      style={[
                        styles.boundingBox,
                        {
                          left: x1,
                          top: y1,
                          width: boxWidth,
                          height: boxHeight,
                          borderColor: strokeColor,
                          backgroundColor: bgColor,
                        },
                      ]}
                    >
                      <View style={[styles.labelBadge, { backgroundColor: strokeColor }]}>
                        <Text style={styles.labelText}>
                          {obj.class_name} {Math.round((obj.confidence || 0) * 100)}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          </View>

          {/* Detected Objects Summary Chips */}
          <View style={styles.chipsContainer}>
            <Text style={styles.chipsTitle}>Detected:</Text>
            {detectedObjects.length === 0 ? (
              <Text style={styles.noChipsText}>Scanning objects...</Text>
            ) : (
              detectedObjects.map((obj, i) => (
                <View key={i} style={[styles.chip, obj.is_unknown && styles.unknownChip]}>
                  <Text style={styles.chipText}>
                    {obj.class_name} {Math.round((obj.confidence || 0) * 100)}%
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Controls & Confidence Threshold Toggle */}
          <View style={styles.controls}>
            <Pressable
              style={[styles.cameraButton, confidenceThreshold === 0.15 && styles.selected]}
              onPress={() => setConfidenceThreshold(0.15)}
            >
              <Text style={styles.buttonText}>Conf 15%</Text>
            </Pressable>
            <Pressable
              style={[styles.cameraButton, confidenceThreshold === 0.25 && styles.selected]}
              onPress={() => setConfidenceThreshold(0.25)}
            >
              <Text style={styles.buttonText}>Conf 25%</Text>
            </Pressable>
            <Pressable
              style={[styles.cameraButton, facing === "front" && styles.selected]}
              onPress={() => setFacing(facing === "front" ? "back" : "front")}
            >
              <Text style={styles.buttonText}>{facing === "front" ? "Rear Cam" : "Front Cam"}</Text>
            </Pressable>
            <Pressable
              style={styles.stopButton}
              onPress={() => {
                setIsStreaming(false);
                setDetectedObjects([]);
              }}
            >
              <Text style={styles.buttonText}>Stop</Text>
            </Pressable>
          </View>

          <Text style={styles.status}>{status}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07111f",
    alignItems: "center",
    padding: 20,
  },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "700", marginTop: 24 },
  subtitle: { color: "#94a3b8", marginBottom: 18 },
  form: { width: "100%", maxWidth: 420, marginTop: 60 },
  input: {
    backgroundColor: "#111e31",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    color: "#f8fafc",
    padding: 14,
    marginBottom: 12,
  },
  primaryButton: { backgroundColor: "#0891b2", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "700" },
  status: { color: "#cbd5e1", textAlign: "center", marginTop: 18 },
  hint: { color: "#64748b", textAlign: "center", marginTop: 12, fontSize: 12 },
  cameraPanel: { width: "100%", flex: 1, marginTop: 24 },
  cameraContainer: {
    width: "100%",
    flex: 1,
    minHeight: 480,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  },
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  boundingBox: {
    position: "absolute",
    borderWidth: 3,
    borderRadius: 6,
    zIndex: 10000,
    elevation: 10000,
  },
  labelBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
    zIndex: 10001,
    elevation: 10001,
  },
  labelText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  controls: { flexDirection: "row", gap: 8, marginTop: 14 },
  cameraButton: { flex: 1, backgroundColor: "#334155", borderRadius: 10, padding: 13, alignItems: "center" },
  selected: { backgroundColor: "#0891b2" },
  stopButton: { backgroundColor: "#b91c1c", borderRadius: 10, padding: 13, paddingHorizontal: 20, alignItems: "center" },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    padding: 10,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  chipsTitle: { color: "#94a3b8", fontSize: 12, fontWeight: "600", marginRight: 4 },
  noChipsText: { color: "#64748b", fontSize: 12, fontStyle: "italic" },
  chip: {
    backgroundColor: "#0891b2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unknownChip: {
    backgroundColor: "#dc2626",
  },
  chipText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
});

