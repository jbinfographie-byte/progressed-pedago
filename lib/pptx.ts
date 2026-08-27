export type PresentationSlide = { title: string; subtitle?: string; bullets: string[] };
export type PresentationDeck = { title: string; subtitle: string; slides: PresentationSlide[]; sources?: string[] };

type ZipEntry = { name: string; data: Uint8Array; crc: number; offset?: number };
const encoder = new TextEncoder();
const SLIDE_WIDTH = 12192000; const SLIDE_HEIGHT = 6858000;

export function createPowerPoint(deck: PresentationDeck): Uint8Array {
  const slides = normalizeSlides(deck);
  const files: Record<string,string> = {
    '[Content_Types].xml': contentTypes(slides.length),
    '_rels/.rels': packageRelationships(),
    'docProps/core.xml': coreProperties(deck.title),
    'docProps/app.xml': appProperties(slides.length),
    'ppt/presentation.xml': presentationXml(slides.length),
    'ppt/_rels/presentation.xml.rels': presentationRelationships(slides.length),
    'ppt/slideMasters/slideMaster1.xml': slideMasterXml(),
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': slideMasterRelationships(),
    'ppt/slideLayouts/slideLayout1.xml': slideLayoutXml(),
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': slideLayoutRelationships(),
    'ppt/theme/theme1.xml': themeXml(),
  };
  slides.forEach((slide,index) => {
    files[`ppt/slides/slide${index + 1}.xml`] = slideXml(slide,index,slides.length);
    files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = slideRelationships();
  });
  return zip(files);
}

export function safePresentationFilename(title: string): string {
  const normalized = title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
  return `${normalized || 'presentation-progressed-pedago'}.pptx`;
}

function normalizeSlides(deck: PresentationDeck): PresentationSlide[] {
  const titleSlide: PresentationSlide = { title:deck.title.slice(0,95),subtitle:deck.subtitle.slice(0,180),bullets:[] };
  const contentSlides = deck.slides.slice(0,18).map((slide) => ({ title:slide.title.slice(0,95),subtitle:String(slide.subtitle ?? '').slice(0,150),bullets:slide.bullets.map((bullet) => String(bullet).replace(/\s+/g,' ').trim().slice(0,180)).filter(Boolean).slice(0,6) }));
  const sources = (deck.sources ?? []).map((source) => String(source).trim()).filter(Boolean).slice(0,12);
  if (sources.length) contentSlides.push({ title:'Sources et prolongements',subtitle:'Références utilisées pour préparer cette présentation',bullets:sources });
  return [titleSlide,...contentSlides];
}

function slideXml(slide: PresentationSlide,index: number,total: number): string {
  const titleSlide = index === 0; const background = titleSlide ? '103F35' : 'F8F8F2'; const titleColor = titleSlide ? 'FFFFFF' : '123F35';
  const title = textShape(2,slide.title,titleSlide ? 731520 : 685800,titleSlide ? 1660000 : 650000,titleSlide ? 10668000 : 10800000,titleSlide ? 1650000 : 900000,titleSlide ? 5000 : 3500,titleColor,true,titleSlide ? 'Georgia' : 'Georgia');
  const subtitle = slide.subtitle ? textShape(3,slide.subtitle,titleSlide ? 762000 : 685800,titleSlide ? 3450000 : 1580000,titleSlide ? 9800000 : 10400000,titleSlide ? 950000 : 620000,titleSlide ? 2400 : 2200,titleSlide ? 'D4E8E1' : '4F6F66',false,'Arial') : '';
  const body = !titleSlide ? bulletShape(4,slide.bullets,900000,2350000,10200000,3300000) : '';
  const accent = titleSlide ? rectangleShape(5,760000,900000,850000,180000,'DFF44C') + rectangleShape(6,760000,1120000,4100000,50000,'7FAE9E') : rectangleShape(5,0,0,180000,SLIDE_HEIGHT,'DFF44C') + rectangleShape(6,10900000,780000,650000,650000,index % 2 ? 'BDE4DC' : 'F5D2C4');
  const brand = titleSlide ? textShape(7,'PROGRESSED PÉDAGO',760000,760000,3800000,400000,1500,'DFF44C',true,'Arial') : textShape(7,'PROGRESSED PÉDAGO',690000,6100000,3600000,260000,1050,'6D8A80',true,'Arial');
  const page = !titleSlide ? textShape(8,`${index} / ${total - 1}`,10500000,6100000,800000,260000,1050,'6D8A80',false,'Arial','r') : '';
  return xmlHeader() + `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${groupProperties()}${accent}${brand}${title}${subtitle}${body}${page}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function textShape(id: number,text: string,x: number,y: number,cx: number,cy: number,size: number,color: string,bold: boolean,font: string,align = 'l'): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Texte ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"/><a:lstStyle/><a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="fr-FR" sz="${size}" b="${bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${escapeXml(font)}"/></a:rPr><a:t>${escapeXml(text)}</a:t></a:r><a:endParaRPr lang="fr-FR" sz="${size}"/></a:p></p:txBody></p:sp>`;
}

function bulletShape(id: number,bullets: string[],x: number,y: number,cx: number,cy: number): string {
  const paragraphs = (bullets.length ? bullets : ['Présenter les notions essentielles avec un exemple concret.']).map((bullet) => `<a:p><a:pPr marL="420000" indent="-220000" spcBef="160"><a:buClr><a:srgbClr val="7E9D22"/></a:buClr><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="fr-FR" sz="1900" dirty="0"><a:solidFill><a:srgbClr val="244E45"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${escapeXml(bullet)}</a:t></a:r><a:endParaRPr lang="fr-FR" sz="1900"/></a:p>`).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Contenu"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
}

function rectangleShape(id: number,x: number,y: number,cx: number,cy: number,color: string): string { return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Accent ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`; }
function groupProperties(): string { return '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'; }

function contentTypes(count: number): string { return xmlHeader() + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${Array.from({length:count},(_,index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`; }
function packageRelationships(): string { return xmlHeader() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'; }
function presentationXml(count: number): string { return xmlHeader() + `<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${Array.from({length:count},(_,index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`; }
function presentationRelationships(count: number): string { return xmlHeader() + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${Array.from({length:count},(_,index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('')}</Relationships>`; }
function slideRelationships(): string { return xmlHeader() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'; }
function slideMasterXml(): string { return xmlHeader() + `<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${groupProperties()}</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`; }
function slideMasterRelationships(): string { return xmlHeader() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>'; }
function slideLayoutXml(): string { return xmlHeader() + `<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Vide"><p:spTree>${groupProperties()}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`; }
function slideLayoutRelationships(): string { return xmlHeader() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'; }
function themeXml(): string { return xmlHeader() + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Progressed Pédago"><a:themeElements><a:clrScheme name="Progressed"><a:dk1><a:srgbClr val="123F35"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="244E45"/></a:dk2><a:lt2><a:srgbClr val="F8F8F2"/></a:lt2><a:accent1><a:srgbClr val="DFF44C"/></a:accent1><a:accent2><a:srgbClr val="BDE4DC"/></a:accent2><a:accent3><a:srgbClr val="F5D2C4"/></a:accent3><a:accent4><a:srgbClr val="7FAE9E"/></a:accent4><a:accent5><a:srgbClr val="A5B72C"/></a:accent5><a:accent6><a:srgbClr val="D6E4F4"/></a:accent6><a:hlink><a:srgbClr val="1769AA"/></a:hlink><a:folHlink><a:srgbClr val="7A4E8B"/></a:folHlink></a:clrScheme><a:fontScheme name="Progressed"><a:majorFont><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Progressed"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'; }
function coreProperties(title: string): string { const now = new Date().toISOString(); return xmlHeader() + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>Progressed Pédago</dc:creator><cp:lastModifiedBy>Progressed Pédago</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`; }
function appProperties(count: number): string { return xmlHeader() + `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Progressed Pédago</Application><PresentationFormat>Écran large (16:9)</PresentationFormat><Slides>${count}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><Company>Progressed Solution</Company><AppVersion>1.0</AppVersion></Properties>`; }

function zip(files: Record<string,string>): Uint8Array {
  const entries: ZipEntry[] = Object.entries(files).map(([name,value]) => { const data = encoder.encode(value); return { name,data,crc:crc32(data) }; });
  const localParts: Uint8Array[] = []; let offset = 0;
  for (const entry of entries) { entry.offset = offset; const name = encoder.encode(entry.name); const header = new Uint8Array(30 + name.length); const view = new DataView(header.buffer); view.setUint32(0,0x04034b50,true); view.setUint16(4,20,true); view.setUint16(6,0x0800,true); view.setUint16(8,0,true); view.setUint32(14,entry.crc,true); view.setUint32(18,entry.data.length,true); view.setUint32(22,entry.data.length,true); view.setUint16(26,name.length,true); header.set(name,30); localParts.push(header,entry.data); offset += header.length + entry.data.length; }
  const centralOffset = offset; const centralParts: Uint8Array[] = [];
  for (const entry of entries) { const name = encoder.encode(entry.name); const header = new Uint8Array(46 + name.length); const view = new DataView(header.buffer); view.setUint32(0,0x02014b50,true); view.setUint16(4,20,true); view.setUint16(6,20,true); view.setUint16(8,0x0800,true); view.setUint16(10,0,true); view.setUint32(16,entry.crc,true); view.setUint32(20,entry.data.length,true); view.setUint32(24,entry.data.length,true); view.setUint16(28,name.length,true); view.setUint32(42,entry.offset ?? 0,true); header.set(name,46); centralParts.push(header); offset += header.length; }
  const end = new Uint8Array(22); const endView = new DataView(end.buffer); endView.setUint32(0,0x06054b50,true); endView.setUint16(8,entries.length,true); endView.setUint16(10,entries.length,true); endView.setUint32(12,offset - centralOffset,true); endView.setUint32(16,centralOffset,true);
  return concatenate([...localParts,...centralParts,end]);
}
function concatenate(parts: Uint8Array[]): Uint8Array { const result = new Uint8Array(parts.reduce((sum,part) => sum + part.length,0)); let offset = 0; for (const part of parts) { result.set(part,offset); offset += part.length; } return result; }
function crc32(data: Uint8Array): number { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function escapeXml(value: string): string { return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function xmlHeader(): string { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'; }
