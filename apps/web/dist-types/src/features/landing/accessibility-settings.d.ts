export declare const ACCESSIBILITY_STORAGE_KEY = "oh_landing_accessibility_v1";
export interface AccessibilitySettings {
    textScale: number;
    grayscale: boolean;
    invert: boolean;
    lowSaturation: boolean;
    highContrast: boolean;
    highlightLinks: boolean;
    underlineLinks: boolean;
    hideImages: boolean;
    readableFont: boolean;
    lineSpacing: boolean;
    letterSpacing: boolean;
    alignLeft: boolean;
    pauseMotion: boolean;
    colorFilter: 'none' | 'redGreen' | 'red' | 'blueYellow';
}
export declare const DEFAULT_ACCESSIBILITY: AccessibilitySettings;
export declare function readAccessibilitySettings(): AccessibilitySettings;
export declare function accessibilityFilter(settings: AccessibilitySettings): string;
//# sourceMappingURL=accessibility-settings.d.ts.map