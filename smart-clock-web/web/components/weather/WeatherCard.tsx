"use client";

type Props = {
  city: string;
  temp: number;
  humidity: number;
  wind: number;
  desc: string;
  icon?: string;
};

export default function WeatherCard({ city, temp, humidity, wind, desc, icon }: Props) {
  return (
    <div className="card">
      <h3 className="title">{city}</h3>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{temp}°C</div>
      <div className="muted">
        {desc} {icon ? `(${icon})` : ""}
      </div>
      <div style={{ marginTop: 10 }}>
        Humidity: <strong>{humidity}%</strong> • Wind: <strong>{wind} m/s</strong>
      </div>
    </div>
  );
}
