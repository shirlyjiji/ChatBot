import React from 'react';
import { Handle, Position } from 'reactflow';
import { Play, MessageSquare, List, Type, Headset, CircleOff, Calendar } from 'lucide-react';

const nodeBaseStyle = {
  padding: '16px',
  borderRadius: '16px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  minWidth: '220px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  fontFamily: "'Inter', sans-serif",
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontWeight: '800',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '12px',
};

const bodyStyle = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#475569',
  fontWeight: '500',
};

const handleStyle = {
  width: '10px',
  height: '10px',
  background: '#cbd5e1',
  border: '2px solid #ffffff',
  boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.8)',
};

export const StartNode = ({ data, selected }) => (
  <div style={{ ...nodeBaseStyle, borderTop: '4px solid #10b981', transform: selected ? 'scale(1.05)' : 'none', boxShadow: selected ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : nodeBaseStyle.boxShadow }}>
    <div style={{ ...headerStyle, color: '#16a34a' }}>
      <div style={{ background: '#ecfdf5', padding: '6px', borderRadius: '8px' }}><Play size={14} fill="#16a34a" /></div>
      START
    </div>
    <div style={bodyStyle}>{data.label || 'Greeting message...'}</div>
    <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: '#10b981' }} />
  </div>
);

export const MessageNode = ({ data, selected }) => (
  <div style={{ ...nodeBaseStyle, borderTop: '4px solid #6366f1', transform: selected ? 'scale(1.05)' : 'none', boxShadow: selected ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : nodeBaseStyle.boxShadow }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <div style={{ ...headerStyle, color: '#4f46e5' }}>
      <div style={{ background: '#eef2ff', padding: '6px', borderRadius: '8px' }}><MessageSquare size={14} fill="#4f46e5" /></div>
      MESSAGE
    </div>
    <div style={bodyStyle}>{data.label || 'Enter message content...'}</div>
    <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: '#6366f1' }} />
  </div>
);

export const OptionNode = ({ data, selected }) => (
  <div style={{ ...nodeBaseStyle, borderTop: '4px solid #f59e0b', transform: selected ? 'scale(1.05)' : 'none', boxShadow: selected ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : nodeBaseStyle.boxShadow }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <div style={{ ...headerStyle, color: '#d97706' }}>
      <div style={{ background: '#fffbeb', padding: '6px', borderRadius: '8px' }}><List size={14} /></div>
      OPTIONS
    </div>
    <div style={{ ...bodyStyle, fontWeight: '700', marginBottom: '12px', color: '#1e293b' }}>{data.question || 'Enter question...'}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {data.options?.map((opt, i) => (
        <div key={i} style={{ position: 'relative', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '700', color: '#475569' }}>
          {opt}
          <Handle
            type="source"
            position={Position.Right}
            id={`opt-${i}`}
            style={{ ...handleStyle, right: '-21px', background: '#f59e0b' }}
          />
        </div>
      ))}
    </div>
  </div>
);

export const InputNode = ({ data, selected }) => (
  <div style={{ ...nodeBaseStyle, borderTop: '4px solid #8b5cf6', transform: selected ? 'scale(1.05)' : 'none', boxShadow: selected ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : nodeBaseStyle.boxShadow }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <div style={{ ...headerStyle, color: '#7c3aed' }}>
      <div style={{ background: '#f5f3ff', padding: '6px', borderRadius: '8px' }}><Type size={14} /></div>
      USER INPUT
    </div>
    <div style={bodyStyle}><strong>{data.label || 'Enter prompt...'}</strong></div>
    <div style={{ fontSize: '10px', marginTop: '6px', color: '#94a3b8', fontStyle: 'italic' }}>Validation: {data.validationType || 'text'}</div>
    <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: '#8b5cf6' }} />
  </div>
);

export const AgentNode = ({ data, selected }) => (
  <div style={{ ...nodeBaseStyle, borderTop: '4px solid #f43f5e', transform: selected ? 'scale(1.05)' : 'none', boxShadow: selected ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : nodeBaseStyle.boxShadow }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <div style={{ ...headerStyle, color: '#e11d48' }}>
      <div style={{ background: '#fff1f2', padding: '6px', borderRadius: '8px' }}><Headset size={14} /></div>
      LIVE AGENT
    </div>
    <div style={{ ...bodyStyle, color: '#ef4444' }}>{data.label || 'Transferring to agent...'}</div>
  </div>
);

export const AppointmentNode = ({ data, selected }) => (
  <div style={{ ...nodeBaseStyle, borderTop: '4px solid #0ea5e9', transform: selected ? 'scale(1.05)' : 'none', boxShadow: selected ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : nodeBaseStyle.boxShadow }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <div style={{ ...headerStyle, color: '#0369a1' }}>
      <div style={{ background: '#f0f9ff', padding: '6px', borderRadius: '8px' }}><Calendar size={14} /></div>
      APPOINTMENT
    </div>
    <div style={bodyStyle}>{data.label || 'Self-service booking'}</div>
    <div style={{ fontSize: '10px', marginTop: '6px', color: '#64748b' }}>
      {data.appointment?.slotDuration || 30}m slots • {data.appointment?.startTime}-{data.appointment?.endTime}
    </div>
    <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: '#0ea5e9' }} />
  </div>
);

export const EndNode = ({ selected }) => (
  <div style={{ ...nodeBaseStyle, borderTop: '4px solid #64748b', minWidth: '160px', transform: selected ? 'scale(1.05)' : 'none', boxShadow: selected ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : nodeBaseStyle.boxShadow }}>
    <Handle type="target" position={Position.Top} style={handleStyle} />
    <div style={{ ...headerStyle, color: '#475569', marginBottom: 0 }}>
      <div style={{ background: '#f1f5f9', padding: '6px', borderRadius: '8px' }}><CircleOff size={14} /></div>
      END FLOW
    </div>
  </div>
);

const CustomNodes = {
  startNode: StartNode,
  messageNode: MessageNode,
  optionNode: OptionNode,
  inputNode: InputNode,
  agentNode: AgentNode,
  endNode: EndNode,
  appointmentNode: AppointmentNode
};

export default CustomNodes;