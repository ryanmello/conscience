'use client';

import { type NodeProps, type Node } from '@xyflow/react';
import { Cog } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export type ProcessNodeData = BaseNodeData;

export type ProcessNodeType = Node<ProcessNodeData, 'process'>;

export default function ProcessNode(props: NodeProps<ProcessNodeType>) {
  return (
    <BaseNode
      {...props}
      data={{
        ...props.data,
        label: props.data.label || 'Process',
        description: props.data.description || 'Transform data',
        icon: Cog,
      }}
      accentColor="border-blue-500/50"
      hasInput={true}
      hasOutput={true}
    />
  );
}
