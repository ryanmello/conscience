'use client';

import { type NodeProps, type Node } from '@xyflow/react';
import { Type } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export type TextNodeData = BaseNodeData & {
  text?: string;
};

export type TextNodeType = Node<TextNodeData, 'text'>;

export default function TextNode(props: NodeProps<TextNodeType>) {
  return (
    <BaseNode
      {...props}
      data={{
        ...props.data,
        label: props.data.label || props.data.text || 'Text Input',
        description: props.data.description || 'Input data',
        icon: Type,
      }}
      accentColor="border-foreground/50"
      hasInput={false}
      hasOutput={true}
    />
  );
}
