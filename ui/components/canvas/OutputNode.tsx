'use client';

import { type NodeProps, type Node } from '@xyflow/react';
import { CheckCircle2 } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export type OutputNodeData = BaseNodeData;

export type OutputNodeType = Node<OutputNodeData, 'output'>;

export default function OutputNode(props: NodeProps<OutputNodeType>) {
  return (
    <BaseNode
      {...props}
      data={{
        ...props.data,
        label: props.data.label || 'Output',
        description: props.data.description || 'Display results',
        icon: CheckCircle2,
      }}
      accentColor="border-green-500/50"
      hasInput={true}
      hasOutput={false}
    />
  );
}
