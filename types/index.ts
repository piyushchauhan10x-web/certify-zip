export interface Recipient {
  id: string;
  name: string;
  email: string;
  category?: string;
  extra: Record<string, string>;
  status: "pending" | "generated" | "sent" | "failed";
  error?: string;
}

export interface TextField {
  id: string;
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: "left" | "center" | "right";
}

export interface TemplateConfig {
  category: string;
  imageData: string;
  width: number;
  height: number;
  fields: TextField[];
}

export interface GeneratedCert {
  recipientId: string;
  pdfBlob: Blob;
  thumbnailUrl: string;
}

export interface User {
  id: string;
  email: string;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_email: string | null;
}
