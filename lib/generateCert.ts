import { jsPDF } from "jspdf";
import { Recipient, TemplateConfig, GeneratedCert, TextField } from "@/types";

function getFieldValue(recipient: Recipient, field: TextField): string {
  if (field.key === "name") return recipient.name;
  if (field.key === "email") return recipient.email;
  return recipient.extra[field.key] || "";
}

export async function generateCertificate(
  recipient: Recipient,
  template: TemplateConfig
): Promise<GeneratedCert> {
  const canvas = document.createElement("canvas");
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext("2d")!;

  await document.fonts.ready;
  const img = await loadImage(template.imageData);
  ctx.drawImage(img, 0, 0, template.width, template.height);

  for (const field of template.fields) {
    const value = getFieldValue(recipient, field);
    ctx.font = `${field.fontSize}px ${field.fontFamily}`;
    ctx.fillStyle = field.color;
    ctx.textAlign = field.align;
    ctx.textBaseline = "middle";
    ctx.fillText(value, field.x, field.y);
  }

  const thumbnailUrl = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: template.width > template.height ? "landscape" : "portrait",
    unit: "px",
    format: [template.width, template.height],
  });
  pdf.addImage(thumbnailUrl, "PNG", 0, 0, template.width, template.height);
  const pdfBlob = pdf.output("blob");

  return { recipientId: recipient.id, pdfBlob, thumbnailUrl };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load certificate artwork. Re-upload the image and try again."));
    img.src = src;
  });
}

export async function generateAll(
  recipients: Recipient[],
  templates: TemplateConfig[],
  onProgress?: (done: number, total: number) => void
): Promise<GeneratedCert[]> {
  const results: GeneratedCert[] = [];
  const valid = recipients.filter((r) => r.status !== "failed");
  const templateMap = new Map(templates.map((t) => [t.category, t]));
  const defaultTemplate = templateMap.get("default") || templates[0];

  for (let i = 0; i < valid.length; i++) {
    const recipient = valid[i];
    const template = templateMap.get(recipient.category || "default") || defaultTemplate;
    if (!template) continue;
    results.push(await generateCertificate(recipient, template));
    onProgress?.(i + 1, valid.length);
  }
  return results;
}
