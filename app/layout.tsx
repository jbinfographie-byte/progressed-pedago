import type { Metadata } from "next";
import "./globals.css";

export const metadata:Metadata = {
  title:"Progressed Pédago",
  description:"L’espace des formateurs pour créer, organiser et animer des activités pédagogiques.",
  icons:{ icon:"/favicon.svg", shortcut:"/favicon.svg" },
  openGraph:{ title:"Progressed Pédago", description:"Créez des formations vivantes et des jeux pédagogiques engageants." },
};
export default function RootLayout({ children }:Readonly<{ children:React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
