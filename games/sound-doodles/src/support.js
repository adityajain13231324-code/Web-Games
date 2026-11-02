import { Clapperboard, Mic, Route, Search, Trophy, Users } from "lucide-react";

export const icons = {
  mic: Mic,
  route: Route,
  duo: Users,
  search: Search,
  film: Clapperboard,
  trophy: Trophy,
};
export const themes = [
  ["midnight", "Midnight Studio", "A little after hours."],
  ["paper", "Paper Playground", "Good old scribbly fun."],
  ["neon", "Neon Arcade", "Turn up the electric."],
  ["sunset", "Sunset Lounge", "Stay for one more round."],
  ["sky", "Cloud Nine", "Light, breezy and cool."],
  ["pop", "Bubblegum Pop", "Hearts, sparkle, zero chill."],
];
export const initialCode =
  new URLSearchParams(location.search).get("room") || "";
export function readStored(key, fallback, storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
