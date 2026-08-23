import type { Metadata } from "next";
import "./globals.css";

export const metadata:Metadata = {
  metadataBase:new URL("https://progressed-pedago.boisfer-jacky.chatgpt.site"),
  title:"Progressed Pédago",
  description:"L’espace des formateurs pour créer, organiser et animer des activités pédagogiques.",
  icons:{ icon:"/favicon.svg", shortcut:"/favicon.svg" },
  openGraph:{ title:"Progressed Pédago", description:"Créez des formations vivantes et des jeux pédagogiques engageants.", images:[{ url:"/og.png", width:1200, height:630, alt:"Progressed Pédago — Créez des formations vivantes" }] },
  twitter:{ card:"summary_large_image", title:"Progressed Pédago", description:"Créez des formations vivantes et des jeux pédagogiques engageants.", images:["/og.png"] },
};
export default function RootLayout({ children }:Readonly<{ children:React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
