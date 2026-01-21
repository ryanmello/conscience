'use client';

import { useCallback, useRef, useState, DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  type Edge,
  type OnConnect,
  type Node,
  ReactFlowProvider,
  useReactFlow,
  ConnectionLineType,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import Sidebar from '../../components/canvas/Sidebar';
import StatusBar from '../../components/canvas/StatusBar';
import TextNode from '../../components/canvas/nodes/TextNode';
import ProcessNode from '../../components/canvas/nodes/ProcessNode';
import OutputNode from '../../components/canvas/nodes/OutputNode';
import AgentNode from '../../components/canvas/nodes/AgentNode';
import { ExecutionStatus } from '../../components/canvas/nodes/BaseNode';

const nodeTypes = {
  text: TextNode,
  process: ProcessNode,
  output: OutputNode,
  agent: AgentNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

let id = 1;
const getId = () => `node_${id++}`;

function getDefaultData(type: string, label?: string, description?: string) {
  const baseData = {
    label: label || getDefaultLabel(type),
    description: description || getDefaultDescription(type),
    executionStatus: 'pending' as ExecutionStatus,
  };
  
  return baseData;
}

function getDefaultLabel(type: string) {
  switch (type) {
    case 'text': return 'Text Input';
    case 'process': return 'Process';
    case 'output': return 'Output';
    case 'agent': return 'AI Agent';
    default: return 'Node';
  }
}

function getDefaultDescription(type: string) {
  switch (type) {
    case 'text': return 'Input data';
    case 'process': return 'Transform data';
    case 'output': return 'Display results';
    case 'agent': return 'AI processing';
    default: return '';
  }
}

const defaultEdgeOptions = {
  type: 'default',
  style: {
    strokeWidth: 2,
  },
};

function CanvasFlow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const edge = {
        ...connection,
        type: 'default',
        animated: false,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/tool-label');
      const description = event.dataTransfer.getData('application/tool-description');

      if (!type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: getDefaultData(type, label, description),
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  // Simulate workflow execution
  const runWorkflow = useCallback(() => {
    if (nodes.length === 0) return;
    
    setIsRunning(true);
    setIsCompleted(false);

    // Reset all nodes to pending
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: { ...node.data, executionStatus: 'pending' as ExecutionStatus },
      }))
    );

    // Animate edges
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        animated: true,
        style: { ...edge.style, stroke: '#3b82f6' },
      }))
    );

    // Find nodes with no incoming edges (start nodes)
    const nodeIds = new Set(nodes.map((n) => n.id));
    const targetIds = new Set(edges.map((e) => e.target));
    const startNodeIds = nodes.filter((n) => !targetIds.has(n.id)).map((n) => n.id);

    // Build adjacency list
    const adjacency: Record<string, string[]> = {};
    edges.forEach((edge) => {
      if (!adjacency[edge.source]) adjacency[edge.source] = [];
      adjacency[edge.source].push(edge.target);
    });

    // Execute nodes in order (simplified simulation)
    let currentNodes = startNodeIds.length > 0 ? startNodeIds : [nodes[0]?.id].filter(Boolean);
    let executed = new Set<string>();
    let delay = 0;

    const executeNode = (nodeId: string, delayMs: number) => {
      // Set to executing
      setTimeout(() => {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, executionStatus: 'executing' as ExecutionStatus } }
              : node
          )
        );
      }, delayMs);

      // Set to completed after a random duration
      const duration = 800 + Math.random() * 1200;
      setTimeout(() => {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    executionStatus: 'completed' as ExecutionStatus,
                    duration: duration,
                  },
                }
              : node
          )
        );

        // Update edges from this node to be green
        setEdges((eds) =>
          eds.map((edge) =>
            edge.source === nodeId
              ? {
                  ...edge,
                  animated: false,
                  style: { ...edge.style, stroke: '#10b981' },
                }
              : edge
          )
        );
      }, delayMs + duration);

      return delayMs + duration;
    };

    // BFS execution
    const queue = [...currentNodes];
    const nodeDelays: Record<string, number> = {};
    
    currentNodes.forEach((id) => {
      nodeDelays[id] = 0;
    });

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (executed.has(nodeId)) continue;
      executed.add(nodeId);

      const startDelay = nodeDelays[nodeId] || delay;
      const endDelay = executeNode(nodeId, startDelay);

      // Queue connected nodes
      const nextNodes = adjacency[nodeId] || [];
      nextNodes.forEach((nextId) => {
        if (!executed.has(nextId)) {
          nodeDelays[nextId] = Math.max(nodeDelays[nextId] || 0, endDelay + 200);
          queue.push(nextId);
        }
      });

      delay = endDelay;
    }

    // Handle nodes not connected (execute them too)
    nodes.forEach((node) => {
      if (!executed.has(node.id)) {
        delay = executeNode(node.id, delay + 200);
        executed.add(node.id);
      }
    });

    // Mark as completed
    setTimeout(() => {
      setIsRunning(false);
      setIsCompleted(true);
    }, delay + 500);
  }, [nodes, edges, setNodes, setEdges]);

  const stopWorkflow = useCallback(() => {
    setIsRunning(false);
    // Reset edge animations
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        animated: false,
        style: { ...edge.style, stroke: '#3b82f6' },
      }))
    );
  }, [setEdges]);

  const resetWorkflow = useCallback(() => {
    setIsCompleted(false);
    setIsRunning(false);
    
    // Reset all nodes to pending
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: { 
          ...node.data, 
          executionStatus: 'pending' as ExecutionStatus,
          duration: undefined,
        },
      }))
    );

    // Reset edges
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        animated: false,
        style: { ...edge.style, stroke: '#3b82f6' },
      }))
    );
  }, [setNodes, setEdges]);

  // Calculate execution stats
  const executionStats = {
    completed: nodes.filter((n) => n.data.executionStatus === 'completed').length,
    failed: nodes.filter((n) => n.data.executionStatus === 'failed').length,
    executing: nodes.filter((n) => n.data.executionStatus === 'executing').length,
    total: nodes.length,
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineType={ConnectionLineType.Bezier}
            connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
            defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
            minZoom={0.3}
            maxZoom={2}
            colorMode="dark"
            className="bg-background"
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="hsl(var(--border))" />
          </ReactFlow>
        </div>
      </div>
      <StatusBar
        nodes={nodes}
        edges={edges}
        isRunning={isRunning}
        isCompleted={isCompleted}
        executionStats={executionStats}
        onStart={runWorkflow}
        onStop={stopWorkflow}
        onReset={resetWorkflow}
      />
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasFlow />
    </ReactFlowProvider>
  );
}
