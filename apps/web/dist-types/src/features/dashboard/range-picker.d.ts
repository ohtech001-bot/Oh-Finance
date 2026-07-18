import type { DashboardRangePreset } from '@oh/contracts';
export interface RangeValue {
    preset: DashboardRangePreset;
    from?: string;
    to?: string;
}
export declare function RangePicker({ value, onChange, }: {
    value: RangeValue;
    onChange: (v: RangeValue) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=range-picker.d.ts.map