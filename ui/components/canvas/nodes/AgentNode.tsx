'use client';

import { type NodeProps, type Node } from '@xyflow/react';
import { Bot } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export type AgentNodeData = BaseNodeData & {
  name?: string;
};

export type AgentNodeType = Node<AgentNodeData, 'agent'>;

export default function AgentNode(props: NodeProps<AgentNodeType>) {
  return (
    <BaseNode
      {...props}
      data={{
        ...props.data,
        label: props.data.label || props.data.name || 'AI Agent',
        description: props.data.description || 'AI processing',
        icon: Bot,
      }}
      accentColor="border-purple-500/50"
      hasInput={true}
      hasOutput={true}
    />
  );
}
