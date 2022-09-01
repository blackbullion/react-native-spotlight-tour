import React, {
  ComponentClass,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import {
  Animated,
  ColorValue,
  LayoutChangeEvent,
  LayoutRectangle,
  Modal,
  Platform,
  StyleProp,
  ViewStyle
} from "react-native";
import { Circle, CircleProps, Defs, Mask, Rect, Svg } from "react-native-svg";

import { vhDP, vwDP } from "../../helpers/responsive";
import { Align, Position, SpotlightTourContext, TourStep } from "../SpotlightTour.context";

import { OverlayView, TipView } from "./TourOverlay.styles";

export interface TourOverlayRef {
  hideTip(): Promise<void>;
}

interface TourOverlayProps {
  color?: ColorValue;
  current: number;
  opacity?: number | string;
  spot: LayoutRectangle;
  tourStep: TourStep;
}

const AnimatedCircle = Animated.createAnimatedComponent<ComponentClass<CircleProps>>(Circle);

export const TourOverlay = React.forwardRef<TourOverlayRef, TourOverlayProps>((props, ref) => {
  const { color = "black", current, opacity = 0.45, spot, tourStep } = props;
  const { next, previous, steps, stop } = useContext(SpotlightTourContext);

  const [tipStyle, setTipStyle] = useState<StyleProp<ViewStyle>>();

  const radius = useRef(new Animated.Value(0)).current;
  const center = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const tipOpacity = useRef(new Animated.Value(0)).current;

  const r = useMemo((): number => {
    return (Math.max(spot.width, spot.height) / 2) * 1.15;
  }, [spot.width, spot.height]);

  const cx = useMemo((): number => {
    return spot.x + (spot.width / 2);
  }, [spot.x, spot.width]);

  const cy = useMemo((): number => {
    return spot.y + (spot.height / 2);
  }, [spot.y, spot.height]);

  /**
   * Animations in the native thread are disabled at the moment as they are
   * causing insonconsistent renders due to the current animation workflow.
   *
   * We need to re-work how animation are executed, plus give the user the
   * option to choose wheher or not the tour should use the native driver.
   */
  const useNativeDriver = useMemo(() => Platform.select({
    android: false,
    default: false,
    ios: false
  }), [Platform.OS]);

  const getTipStyles = useCallback((tipLayout: LayoutRectangle): StyleProp<ViewStyle> => {
    const tipMargin: string = "2%";
    const align = tourStep?.alignTo ?? Align.SPOT;

    switch (tourStep?.position) {
      case Position.BOTTOM: return {
        left: align === Align.SPOT
          ? Math.round(cx - (tipLayout.width / 2))
          : Math.round((vwDP(100) - tipLayout.width) / 2),
        marginTop: tipMargin,
        top: Math.round(cy + r)
      };

      case Position.TOP: return {
        left: align === Align.SPOT
          ? Math.round(cx - (tipLayout.width / 2))
          : Math.round((vwDP(100) - tipLayout.width) / 2),
        marginBottom: tipMargin,
        top: Math.round(cy - r - tipLayout.height)
      };

      case Position.LEFT: return {
        left: Math.round(cx - r - tipLayout.width),
        marginRight: tipMargin,
        top: Math.round(cy - (tipLayout.height / 2))
      };

      case Position.RIGHT: return {
        left: Math.round(cx + r),
        marginLeft: tipMargin,
        top: Math.round(cy - (tipLayout.height / 2))
      };
    }
  }, [r, cx, cy, tourStep.position, tourStep.alignTo]);

  const measureTip = (event: LayoutChangeEvent) => {
    setTipStyle(getTipStyles(event.nativeEvent.layout));
  };

  useEffect(() => {
    const moveIn = Animated.parallel([
      Animated.spring(center, {
        damping: 50,
        mass: 5,
        stiffness: 300,
        toValue: { x: cx, y: cy },
        useNativeDriver
      }),
      Animated.spring(radius, {
        damping: 30,
        mass: 5,
        stiffness: 300,
        toValue: r,
        useNativeDriver
      }),
      Animated.timing(tipOpacity, {
        delay: 500,
        duration: 500,
        toValue: 1,
        useNativeDriver
      })
    ]);

    setTipStyle(undefined);
    moveIn.start();

    return () => moveIn.stop();
  }, [spot, current]);

  useImperativeHandle(ref, () => ({
    hideTip() {
      return new Promise<void>((resolve, reject) => {
        Animated.timing(tipOpacity, {
          duration: 200,
          toValue: 0,
          useNativeDriver
        })
        .start(({ finished }) => finished
          ? resolve()
          : reject()
        );
      });
    }
  }));

  return (
    <Modal
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent={true}
      visible={true}
    >
      <OverlayView accessibilityLabel="Tour Overlay View">
        <Svg
          accessibilityLabel="Svg overlay view"
          height="100%"
          width="100%"
          viewBox={`0 0 ${vwDP(100)} ${vhDP(100)}`}
        >
          <Defs>
            <Mask id="mask" x={0} y={0} height="100%" width="100%">
              <Rect height="100%" width="100%" fill="#fff" />
              <AnimatedCircle
                r={radius}
                cx={center.x}
                cy={center.y}
                fill="black"
              />
            </Mask>
          </Defs>

          <Rect
            height="100%"
            width="100%"
            fill={color}
            mask="url(#mask)"
            opacity={opacity}
          />
        </Svg>

        <TipView
          accessibilityLabel="Tip Overlay View"
          onLayout={measureTip}
          style={[tipStyle, { opacity: tipOpacity }]}
        >
          <tourStep.render
            current={current}
            isFirst={current === 0}
            isLast={current === steps.length - 1}
            next={next}
            previous={previous}
            stop={stop}
          />
        </TipView>
      </OverlayView>
    </Modal>
  );
});
