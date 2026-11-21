import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Camera, RefreshCw, X, Check, Image as ImageIcon } from 'lucide-react-native';
import THEME from '../constants/theme';
import Button from './Button';

interface CameraModalProps {
  visible: boolean;
  title: string;
  facingDefault?: CameraType;
  allowGallery?: boolean;
  onClose: () => void;
  onCapture: (photoUri: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  visible,
  title,
  facingDefault = 'front',
  allowGallery = false,
  onClose,
  onCapture,
}) => {
  const [facing, setFacing] = useState<CameraType>(facingDefault);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const cameraRef = useRef<any>(null);

  const toggleFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        setLoading(true);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true,
        });

        let finalUri = photo?.uri || '';
        if (photo?.base64) {
          finalUri = photo.base64.startsWith('data:')
            ? photo.base64
            : `data:image/jpeg;base64,${photo.base64}`;
        } else if (Platform.OS === 'web' && photo?.uri && photo.uri.startsWith('blob:')) {
          try {
            const blobRes = await fetch(photo.uri);
            const blob = await blobRes.blob();
            finalUri = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string) || photo.uri);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.warn('[CameraModal] Blob to dataUrl conversion note:', e);
            finalUri = photo.uri;
          }
        }

        if (finalUri) {
          setCapturedUri(finalUri);
        }
      } catch (e) {
        console.warn('Take photo failed', e);
      } finally {
        setLoading(false);
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        if (uri) setCapturedUri(uri);
      }
    } catch (e) {
      console.warn('Pick image failed', e);
    }
  };

  const handleConfirm = () => {
    if (capturedUri) {
      onCapture(capturedUri);
      setCapturedUri(null);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={24} color={THEME.colors.textWhite} />
          </TouchableOpacity>
        </View>

        {capturedUri ? (
          /* Preview State */
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedUri }} style={styles.previewImage} />
            <View style={styles.previewActions}>
              <Button
                title="Retake"
                variant="outline"
                onPress={handleRetake}
                style={styles.actionBtn}
                textStyle={{ color: THEME.colors.textWhite }}
              />
              <Button
                title="Confirm & Upload"
                variant="primary"
                onPress={handleConfirm}
                style={styles.actionBtn}
              />
            </View>
          </View>
        ) : !permission || !permission.granted ? (
          /* Permission Request State */
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Camera access is required for attendance & verification photos.
            </Text>
            <Button
              title="Grant Permission"
              onPress={requestPermission}
              style={{ marginBottom: 16 }}
            />
            {allowGallery && (
              <Button
                title="Choose from Gallery instead"
                variant="outline"
                onPress={pickImage}
              />
            )}
          </View>
        ) : (
          /* Live Camera View */
          <View style={styles.cameraWrapper}>
            <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
              <View style={styles.cameraControls}>
                {allowGallery ? (
                  <TouchableOpacity onPress={pickImage} style={styles.controlIconBtn}>
                    <ImageIcon size={26} color={THEME.colors.textWhite} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 50, height: 50 }} />
                )}

                <TouchableOpacity
                  onPress={takePhoto}
                  disabled={loading}
                  style={styles.captureBtn}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={THEME.colors.primaryDark} />
                  ) : (
                    <View style={styles.captureInner} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={toggleFacing} style={styles.controlIconBtn}>
                  <RefreshCw size={24} color={THEME.colors.textWhite} />
                </TouchableOpacity>
              </View>
            </CameraView>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  title: {
    color: THEME.colors.textWhite,
    fontSize: THEME.typography.sizes.lg,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  cameraWrapper: {
    flex: 1,
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: THEME.colors.textWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.colors.primary,
  },
  controlIconBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  permissionText: {
    color: THEME.colors.textWhite,
    fontSize: THEME.typography.sizes.base,
    textAlign: 'center',
    marginBottom: 24,
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  previewActions: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 0.48,
  },
});

export default CameraModal;

