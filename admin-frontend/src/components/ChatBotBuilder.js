import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  applyEdgeChanges,
  applyNodeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';

import CustomNodes from './nodes/CustomNodes';
import ChatPreview from './ChatPreview';
import api from '../utils/api';

const nodeTypes = CustomNodes;

// ID counter for NEW nodes
let id = 0;
const getId = () => `node_${Date.now()}_${id++}`;

const ChatBotBuilder = ({ user }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [currentFlowId, setCurrentFlowId] = useState(null);

  const onNodesChange = useCallback((chs) => setNodes((nds) => applyNodeChanges(chs, nds)), []);
  const onEdgesChange = useCallback((chs) => setEdges((eds) => applyEdgeChanges(chs, eds)), []);
  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const onNodesDelete = useCallback((deletedNodes) => {
    const deletedIds = deletedNodes.map(n => n.id);
    setEdges((eds) => eds.filter(e => !deletedIds.includes(e.source) && !deletedIds.includes(e.target)));

    // Clear selection if the selected node was deleted
    setSelectedNode(prev => {
      if (prev && deletedIds.includes(prev.id)) return null;
      return prev;
    });
  }, []);



  // --- DYNAMIC LOAD FLOW BY COMPANY ---
  useEffect(() => {
    const loadFlow = async () => {
      // For Super Admin, we might need a way to select companyId, 
      // but for now, we only fetch if companyId is present.
      if (!user?.companyId) {
        console.warn("No Company ID found for user:", user);
        return;
      }

      try {
        console.log(`Fetching flow for company: ${user.companyId}`);
        const response = await api.get(`/api/flows/company/${user.companyId}`);
        const data = response.data;

        if (data && data.nodes) {
          console.log("Flow Data Received:", data);
          setCurrentFlowId(data._id);

          // HEAL DATA: Filter out edges that point to non-existent nodes (legacy data fix)
          const nodeIds = new Set(data.nodes.map(n => n.id));
          const sanitizedEdges = (data.edges || []).filter(edge =>
            nodeIds.has(edge.source) && nodeIds.has(edge.target)
          );

          setNodes(data.nodes);
          setEdges(sanitizedEdges);

          // Trigger fitView after a small delay to ensure nodes are rendered
          setTimeout(() => {
            if (reactFlowInstance) {
              reactFlowInstance.fitView();
            }
          }, 100);
        } else {
          console.log("No existing flow found for this company.");
          setNodes([]);
          setEdges([]);
        }
      } catch (err) {
        console.error("Load Error:", err);
      }
    };
    loadFlow();
  }, [user, reactFlowInstance]); // Added reactFlowInstance to dependencies to allow fitView

  // --- DYNAMIC SAVE FLOW ---
  const onSave = useCallback(async () => {
    if (reactFlowInstance && user?.companyId) {
      const viewport = reactFlowInstance.getViewport();
      const payload = {
        id: currentFlowId,
        companyId: user.companyId,
        name: `${user.companyName || 'Company'} Default Flow`,
        createdBy: user.username,
        nodes: nodes,
        edges: edges,
        viewport: viewport
      };

      try {
        const response = await api.post('/api/flows/save', payload);
        const result = response.data;
        setCurrentFlowId(result._id);
        alert('Flow saved successfully!');
      } catch (err) {
        alert('Save Failed!');
      }
    } else {
      alert("Cannot save flow without company context.");
    }
  }, [reactFlowInstance, user, currentFlowId, nodes, edges]);

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance) return;

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    const newNode = {
      id: getId(),
      type,
      position,
      data: {
        label: type === 'startNode' ? 'Welcome to FineChat!' : 'New Message',
        question: 'New Question?',
        options: ['Yes', 'No'],
        validationType: 'text'
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance]);

  const updateNodeData = (newData) => {
    // 1. Update edges if options changed (Do this first to avoid closure issues)
    if (newData.options && selectedNode.type === 'optionNode') {
      const oldOptions = selectedNode.data.options || [];
      const newOptions = newData.options;

      setEdges((eds) => eds.map(edge => {
        if (edge.source === selectedNode.id && edge.sourceHandle?.startsWith('opt-')) {
          const optIndex = parseInt(edge.sourceHandle.split('-')[1]);
          const optionText = oldOptions[optIndex];

          if (optionText) {
            const newIndex = newOptions.indexOf(optionText);
            if (newIndex !== -1) {
              return { ...edge, sourceHandle: `opt-${newIndex}` };
            }
          }
        }
        return edge;
      }));
    }

    // 2. Update node data
    setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, ...newData } } : n));

    // 3. Update selection state
    setSelectedNode(prev => ({ ...prev, data: { ...prev.data, ...newData } }));
  };

  const deleteNode = (nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  return (
    <div className="builder-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Flow Builder</h1>
          <p className="view-subtitle">Design your automated conversation flow for {user?.companyName || 'your company'}</p>
        </div>
        <div className="nav-actions">
          <button className="save-btn" onClick={onSave}>Save Changes</button>
          <button className="test-btn" onClick={() => setShowPreview(true)}>Run Simulation</button>
        </div>
      </div>

      <div className="builder-container">
        {/* LEFT: COMPONENTS */}
        <aside className="builder-sidebar">
          <p className="sidebar-title">COMPONENTS</p>
          <div className="dndnode" onDragStart={(e) => onDragStart(e, 'startNode')} draggable>Start Node</div>
          <div className="dndnode" onDragStart={(e) => onDragStart(e, 'messageNode')} draggable>Message</div>
          <div className="dndnode" onDragStart={(e) => onDragStart(e, 'optionNode')} draggable>Options</div>
          <div className="dndnode" onDragStart={(e) => onDragStart(e, 'inputNode')} draggable>User Input</div>
          <div className="dndnode calendar" onDragStart={(e) => onDragStart(e, 'appointmentNode')} draggable>Appointment</div>
          <div className="dndnode agent" onDragStart={(e) => onDragStart(e, 'agentNode')} draggable>Talk to Agent</div>
          <div className="dndnode end" onDragStart={(e) => onDragStart(e, 'endNode')} draggable>End Flow</div>
        </aside>

        {/* MIDDLE: FLOW CANVAS */}
        <div className="flow-container" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={onNodesDelete}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onNodeClick={(_, node) => setSelectedNode(node)}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#cbd5e1" gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {/* RIGHT: PROPERTIES */}
        <aside className="builder-sidebar settings">
          {selectedNode ? (
            <div className="settings-panel">
              <p className="sidebar-title">PROPERTIES</p>
              <label>Message Content</label>
              <textarea
                rows="4"
                value={selectedNode.data.label || selectedNode.data.question || ''}
                onChange={(e) => updateNodeData({ label: e.target.value, question: e.target.value })}
              />

              {selectedNode.type === 'optionNode' && (
                <>
                  <label>Buttons (Comma separated)</label>
                  <input
                    type="text"
                    value={selectedNode.data.options?.join(', ') || ''}
                    onChange={(e) => {
                      const values = e.target.value.split(',').map(o => o.trim());
                      updateNodeData({ options: values });
                    }}
                  />
                </>
              )}

              {selectedNode.type === 'inputNode' && (
                <>
                  <label>Data Validation</label>
                  <select
                    value={selectedNode.data.validationType || 'text'}
                    onChange={(e) => updateNodeData({ validationType: e.target.value })}
                  >
                    <option value="text">Any Text</option>
                    <option value="email">Email</option>
                    <option value="number">Numbers/Phone</option>
                  </select>
                </>
              )}

              {selectedNode.type === 'appointmentNode' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label>From</label>
                      <input type="time" value={selectedNode.data.appointment?.startTime || '09:00'} onChange={(e) => updateNodeData({ appointment: { ...selectedNode.data.appointment, startTime: e.target.value } })} />
                    </div>
                    <div>
                      <label>To</label>
                      <input type="time" value={selectedNode.data.appointment?.endTime || '17:00'} onChange={(e) => updateNodeData({ appointment: { ...selectedNode.data.appointment, endTime: e.target.value } })} />
                    </div>
                  </div>
                </>
              )}

              <button className="delete-btn" onClick={() => deleteNode(selectedNode.id)}>Delete Node</button>
            </div>
          ) : (
            <div className="empty-state">
              Select a node to edit
            </div>
          )}
        </aside>
      </div>

      {showPreview && <ChatPreview nodes={nodes} edges={edges} onClose={() => setShowPreview(false)} />}
    </div>
  );
};

export default ChatBotBuilder;