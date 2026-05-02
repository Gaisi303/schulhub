import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

export interface MindNodeData {
  label: string;
  color: string; // tailwind gradient classes, e.g. "from-violet-500 to-purple-500"
  shape: "rounded" | "pill" | "square" | "diamond";
  textColor?: string; // optional override
}

const SHAPE_CLASSES: Record<MindNodeData["shape"], string> = {
  rounded: "rounded-2xl",
  pill: "rounded-full",
  square: "rounded-md",
  diamond: "rounded-md rotate-45",
};

function MindNodeBase({ data, selected }: NodeProps<MindNodeData>) {
  const isDiamond = data.shape === "diamond";
  return (
    <div
      className={`bg-gradient-to-br ${data.color} ${SHAPE_CLASSES[data.shape]} shadow-lg ${
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
      style={{
        minWidth: isDiamond ? 90 : 120,
        minHeight: isDiamond ? 90 : 50,
        padding: isDiamond ? 18 : 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div
        className={`text-center text-sm font-semibold leading-tight break-words ${data.textColor || "text-white"}`}
        style={{
          transform: isDiamond ? "rotate(-45deg)" : undefined,
          maxWidth: isDiamond ? 90 : 200,
        }}
      >
        {data.label || "Knoten"}
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="target" position={Position.Left} id="l" />
    </div>
  );
}

export const MindNode = memo(MindNodeBase);
