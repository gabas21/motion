"use client";

import {
  SunIcon,
  MoonIcon,
  CloudIcon,
  PartlyCloudyIcon,
  RainIcon,
  HeavyRainIcon,
  SnowIcon,
  ThunderIcon,
  WindIcon,
  FogIcon,
  SunriseIcon,
  RainbowIcon,
} from "@/components/ui/animated-weather-icons";

const ALL_ICONS = [
  { name: "Sun", Icon: SunIcon },
  { name: "Moon", Icon: MoonIcon },
  { name: "Cloud", Icon: CloudIcon },
  { name: "Partly Cloudy", Icon: PartlyCloudyIcon },
  { name: "Rain", Icon: RainIcon },
  { name: "Heavy Rain", Icon: HeavyRainIcon },
  { name: "Snow", Icon: SnowIcon },
  { name: "Thunder", Icon: ThunderIcon },
  { name: "Wind", Icon: WindIcon },
  { name: "Fog", Icon: FogIcon },
  { name: "Sunrise", Icon: SunriseIcon },
  { name: "Rainbow", Icon: RainbowIcon },
];

export function WeatherDemoComponent() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">
          Animated Weather Icons
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Each icon is a living micro-scene — rain falls, lightning flashes, sun rays rotate, snowflakes drift. No hover required.
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6 justify-items-center">
        {ALL_ICONS.map(({ name, Icon }) => (
          <div key={name} className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl border border-black bg-white shadow-neo-sm">
              <Icon size={36} />
            </div>
            <span className="text-[10px] font-bold text-black/70 tracking-wide text-center leading-tight">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Demo() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <WeatherDemoComponent />
    </div>
  );
}
