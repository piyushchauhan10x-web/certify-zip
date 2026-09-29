"use client";
import { useRef, useState } from "react";
import { TemplateConfig, TextField } from "@/types";
import { nanoid } from "nanoid";

interface Props {
  categories: string[];
  fieldOptions: { key: string; label: string }[];
  onReady: (templates: TemplateConfig[]) => void;
}

const FONT_CHOICES = ["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Trebuchet MS", "Comic Sans MS"];

export default function TemplateManager({ categories, fieldOptions, onReady }: Props) {
  const cats = categories.length > 0 ? categories : ["default"];
  const [activeCat, setActiveCat] = useState(cats[0]);
  const [templates, setTemplates] = useState<Record<string, TemplateConfig>>({});
  const [selectedFieldKey, setSelectedFieldKey] = useState(fieldOptions[0]?.key || "name");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const current = templates[activeCat];
  const editingField = current?.fields.find((f) => f.id === editingFieldId) || null;

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const config: TemplateConfig = {
          category: activeCat,
          imageData: src,
          width: img.width,
          height: img.height,
          fields: [],
        };
        setTemplates((prev) => ({ ...prev, [activeCat]: config }));
        draw(config);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function draw(config: TemplateConfig, highlightId?: string | null) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = config.width;
    canvas.height = config.height;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, config.width, config.height);
      config.fields.forEach((f) => {
        ctx.font = `${f.fontSize}px ${f.fontFamily}`;
        ctx.fillStyle = f.color;
        ctx.textAlign = f.align;
        ctx.fillText(`{${f.label}}`, f.x, f.y);

        if (f.id === highlightId) {
          const metrics = ctx.measureText(`{${f.label}}`);
          const w = metrics.width;
          let boxX = f.x;
          if (f.align === "center") boxX = f.x - w / 2;
          if (f.align === "right") boxX = f.x - w;
          ctx.strokeStyle = "#F9654B";
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 6]);
          ctx.strokeRect(boxX - 8, f.y - f.fontSize / 2 - 8, w + 16, f.fontSize + 16);
          ctx.setLineDash([]);
        }
      });
    };
    img.src = config.imageData;
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = current.width / rect.width;
    const scaleY = current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const label = fieldOptions.find((f) => f.key === selectedFieldKey)?.label || selectedFieldKey;
    const newField: TextField = {
      id: nanoid(6),
      key: selectedFieldKey,
      label,
      x,
      y,
      fontSize: 32,
      fontFamily: "Arial",
      color: "#000000",
      align: "center",
    };
    const updated = { ...current, fields: [...current.fields, newField] };
    setTemplates((prev) => ({ ...prev, [activeCat]: updated }));
    setEditingFieldId(newField.id);
    draw(updated, newField.id);
  }

  function updateField(fieldId: string, changes: Partial<TextField>) {
    if (!current) return;
    const updated = {
      ...current,
      fields: current.fields.map((f) => (f.id === fieldId ? { ...f, ...changes } : f)),
    };
    setTemplates((prev) => ({ ...prev, [activeCat]: updated }));
    draw(updated, fieldId);
  }

  function removeField(fieldId: string) {
    if (!current) return;
    const updated = { ...current, fields: current.fields.filter((f) => f.id !== fieldId) };
    setTemplates((prev) => ({ ...prev, [activeCat]: updated }));
    if (editingFieldId === fieldId) setEditingFieldId(null);
    draw(updated);
  }

  function handleDone() {
    onReady(Object.values(templates));
  }

  const allCatsHaveTemplate = cats.every((c) => templates[c]);

  return (
    <div className="space-y-6 text-gray-900">
      {/* Category Tabs if multiple categories */}
      {cats.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => {
                setActiveCat(c);
                setEditingFieldId(null);
              }}
              className={`text-xs px-4 py-2 rounded-xl font-medium border transition-all ${
                activeCat === c
                  ? "bg-[#F9654B] border-[#F9654B] text-white shadow-xs"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900"
              }`}
            >
              {c} {templates[c] ? "✓" : ""}
            </button>
          ))}
        </div>
      )}

      {/* File Upload Control if no template loaded for active category */}
      {!current && (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0ED] text-[#F9654B] flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Upload Certificate Artwork</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Select a high-resolution PNG or JPG image template to overlay recipient details onto.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 bg-[#F9654B] hover:bg-[#E04F34] text-white text-xs font-semibold px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-xs">
            <span>Browse Image File</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      )}

      {current && (
        <div className="space-y-6">
          {/* Top Toolbar */}
          <div className="bg-[#F9FAFB] border border-gray-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3 max-w-[950px] mx-auto">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-semibold text-gray-700">Field to place:</span>
              <select
                value={selectedFieldKey}
                onChange={(e) => setSelectedFieldKey(e.target.value)}
                className="bg-white border border-gray-300 text-gray-900 font-medium rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#F9654B]"
              >
                {fieldOptions.map((f) => (
                  <option key={f.key} value={f.key} className="bg-white text-gray-900">
                    {f.label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-gray-500">
                (click anywhere on canvas to place)
              </span>
            </div>

            <label className="text-xs text-[#F9654B] hover:underline cursor-pointer font-medium">
              Change Image
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          </div>

          {/* Large Canvas Container */}
          <div className="w-full max-w-[950px] mx-auto bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-xs flex items-center justify-center overflow-hidden">
            <canvas
              ref={canvasRef}
              onClick={handleClick}
              className="w-full h-auto object-contain cursor-crosshair rounded-xl border border-gray-300 bg-white shadow-sm transition-all"
            />
          </div>

          {/* Field Editing Controls (Light Theme) */}
          {editingField ? (
            <div className="bg-[#F9FAFB] border border-gray-200 rounded-2xl p-5 space-y-4 shadow-xs text-gray-900 max-w-[950px] mx-auto">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <span className="text-sm font-bold text-gray-900">
                  Editing: {editingField.label}
                </span>
                <button
                  onClick={() => setEditingFieldId(null)}
                  className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Close ✕
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-700 font-medium mb-1.5 block">Font size (px)</label>
                  <input
                    type="number"
                    min={8}
                    max={200}
                    value={editingField.fontSize}
                    onChange={(e) => updateField(editingField.id, { fontSize: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F9654B]"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-700 font-medium mb-1.5 block">Text Color</label>
                  <input
                    type="color"
                    value={editingField.color}
                    onChange={(e) => updateField(editingField.id, { color: e.target.value })}
                    className="w-full h-10 bg-white border border-gray-300 rounded-xl px-1.5 py-1 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-700 font-medium mb-1.5 block">Font Family</label>
                  <select
                    value={editingField.fontFamily}
                    onChange={(e) => updateField(editingField.id, { fontFamily: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F9654B]"
                  >
                    {FONT_CHOICES.map((f) => (
                      <option key={f} value={f} className="bg-white text-gray-900" style={{ fontFamily: f }}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-700 font-medium mb-1.5 block">Alignment</label>
                  <select
                    value={editingField.align}
                    onChange={(e) => updateField(editingField.id, { align: e.target.value as TextField["align"] })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F9654B]"
                  >
                    <option value="left" className="bg-white text-gray-900">Left</option>
                    <option value="center" className="bg-white text-gray-900">Center</option>
                    <option value="right" className="bg-white text-gray-900">Right</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs text-gray-700 font-medium mb-1.5 block">X position</label>
                  <input
                    type="number"
                    value={Math.round(editingField.x)}
                    onChange={(e) => updateField(editingField.id, { x: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F9654B]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-700 font-medium mb-1.5 block">Y position</label>
                  <input
                    type="number"
                    value={Math.round(editingField.y)}
                    onChange={(e) => updateField(editingField.id, { y: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F9654B]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-gray-200">
                <button
                  onClick={() => removeField(editingField.id)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium transition-colors"
                >
                  Remove field
                </button>
                <button
                  onClick={() => setEditingFieldId(null)}
                  className="text-xs bg-white text-gray-800 px-3 py-1.5 rounded-lg border border-gray-300 hover:border-gray-400 font-medium"
                >
                  Done Editing
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#F9FAFB] border border-gray-200 rounded-2xl p-4 text-center text-gray-500 text-xs max-w-[950px] mx-auto">
              Click any tag on the canvas or in the list below to edit its properties.
            </div>
          )}

          {/* List of Placed Fields */}
          {current.fields.length > 0 && (
            <div className="bg-[#F9FAFB] border border-gray-200 rounded-2xl p-4 space-y-2 max-w-[950px] mx-auto">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Placed Fields ({current.fields.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {current.fields.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setEditingFieldId(f.id);
                      draw(current, f.id);
                    }}
                    className={`w-full flex items-center justify-between text-xs border rounded-xl p-3 transition-all ${
                      editingFieldId === f.id
                        ? "border-[#F9654B] bg-[#FFF0ED] text-[#F9654B] font-medium"
                        : "border-gray-200 bg-white text-gray-800 hover:border-gray-400"
                    }`}
                  >
                    <span className="truncate">{f.label} — {f.fontSize}px, {f.fontFamily}</span>
                    <span className="text-[#F9654B] text-[11px] font-semibold shrink-0 ml-2">Edit</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Action Button */}
      <div className="pt-2 flex justify-end max-w-[950px] mx-auto">
        <button
          onClick={handleDone}
          disabled={!allCatsHaveTemplate}
          className="bg-[#F9654B] hover:bg-[#E04F34] text-white font-medium px-6 py-3 rounded-xl disabled:opacity-40 transition-all text-sm shadow-xs"
        >
          {allCatsHaveTemplate ? "Save templates & proceed" : `Upload template for all categories (${Object.keys(templates).length}/${cats.length})`}
        </button>
      </div>
    </div>
  );
}


