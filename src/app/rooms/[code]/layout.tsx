import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gift Circle Room",
};

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
