import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  InteractionManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';

export interface AppBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  bottomInset?: number;
  snapPoints?: string[];
  enableDynamicSizing?: boolean;
  contentContainerStyle?: any;
}

export function AppBottomSheet({
  visible,
  onClose,
  title,
  children,
  bottomInset = 18,
  snapPoints,
  enableDynamicSizing = false,
  contentContainerStyle,
}: AppBottomSheetProps) {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const visibleRef = useRef(visible);
  const presentedRef = useRef(false);
  const dismissFromParentRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(visible);

  // Default snap points if dynamic sizing is not preferred
  const defaultSnapPoints = useMemo(() => ['50%', '90%'], []);
  const activeSnapPoints = snapPoints || defaultSnapPoints;

  useEffect(() => {
    visibleRef.current = visible;

    if (visible) {
      dismissFromParentRef.current = false;
      setShouldRender(true);
    }
  }, [visible]);

  const presentSheet = useCallback(() => {
    if (!visibleRef.current) {
      return;
    }

    bottomSheetModalRef.current?.present();
  }, []);

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    let frameId: number | null = null;
    const retryTimers: ReturnType<typeof setTimeout>[] = [];
    let interactionHandle: { cancel?: () => void } | null = null;

    if (visible) {
      interactionHandle = InteractionManager.runAfterInteractions(() => {
        frameId = requestAnimationFrame(presentSheet);
      });
      [80, 180, 320, 520].forEach(delay => {
        retryTimers.push(setTimeout(presentSheet, delay));
      });
    } else if (presentedRef.current) {
      dismissFromParentRef.current = true;
      bottomSheetModalRef.current?.dismiss();
    } else {
      setShouldRender(false);
    }

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      retryTimers.forEach(clearTimeout);

      interactionHandle?.cancel?.();
    };
  }, [presentSheet, shouldRender, visible]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index >= 0) {
      presentedRef.current = true;
      dismissFromParentRef.current = false;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    presentedRef.current = false;
    setShouldRender(false);

    if (dismissFromParentRef.current) {
      dismissFromParentRef.current = false;
      return;
    }

    if (visibleRef.current) {
      onClose();
    }
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    [],
  );

  const renderHandle = useCallback(
    () => (
      <View style={styles.handleContainer}>
        <View style={styles.sheetHandle} />
      </View>
    ),
    [],
  );

  if (!shouldRender) {
    return null;
  }

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={enableDynamicSizing ? undefined : activeSnapPoints}
      enableDynamicSizing={enableDynamicSizing}
      onChange={handleSheetChanges}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView
        style={[
          styles.contentContainer,
          { paddingBottom: Math.max(bottomInset, 18) },
          contentContainerStyle,
        ]}
      >
        {title && (
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity
              onPress={() => bottomSheetModalRef.current?.dismiss()}
              style={styles.sheetClose}
            >
              <Ionicons color="#FFFFFF" name="close" size={20} />
            </TouchableOpacity>
          </View>
        )}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#0F1115',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  contentContainer: {
    paddingHorizontal: 18,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 24,
  },
  sheetHandle: {
    backgroundColor: '#2A303C',
    borderRadius: 3,
    height: 5,
    width: 48,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  sheetClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
});
