import { useEffect, useState } from "react";

const KEY = "menuwise:threshold";
export const THRESHOLD_OPTIONS = [
  { days: 1, label: "1 day" },
  { days: 2, label: "2 days" },
  { days: 3, label: "3 days" },
  { days: 4, label: "4 days" },
  { days: 5, label: "5 days" },
  { days: 6, label: "6 days" },
  { days: 7, label: "7 days" },
  { days: 14, label: "2 weeks" },
];
export const thresholdLabel = (d: number) => THRESHOLD_OPTIONS.find((o) => o.days === d)?.label ?? `${d} days`;

/** Ongoing Insights expiry threshold, shared by Dashboard and Ingredient list. Default 7 days. */
export function useThreshold(): [number, (d: number) => void] {
  const [days, setDays] = useState(7);
  useEffect(() => {
    const v = Number(localStorage.getItem(KEY));
    if (v) setDays(v);
  }, []);
  return [
    days,
    (d) => {
      setDays(d);
      localStorage.setItem(KEY, String(d));
    },
  ];
}
