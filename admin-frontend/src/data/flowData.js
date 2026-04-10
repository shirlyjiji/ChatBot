const flowData = {
  nodes: [
    {
      id: "greeting",
      type: "message",
      data: {
        text: "Hello! How can I help you?",
        options: [
          { label: "Order Details", target: "order" },
          { label: "Pricing", target: "pricing" },
          { label: "Call Me Back", target: "callback" },
          { label: "Connect to Agent", target: "agent" }
        ]
      },
      position: { x: 250, y: 0 }
    },

    {
      id: "order",
      type: "message",
      data: {
        text: "Your Orders",
        list: ["ORD-101", "ORD-102", "ORD-103"]
      },
      position: { x: 0, y: 200 }
    },

    {
      id: "pricing",
      type: "message",
      data: {
        text: "Pricing Plans",
        list: ["Basic: $10", "Pro: $20", "Enterprise: $50"]
      },
      position: { x: 250, y: 200 }
    },

    {
      id: "callback",
      type: "form",
      data: {
        fields: ["Name", "Phone", "Preferred Time", "Email"]
      },
      position: { x: 500, y: 200 }
    },

    {
      id: "agent",
      type: "agent",
      data: {
        text: "Connecting to a live agent..."
      },
      position: { x: 750, y: 200 }
    }
  ],

  edges: [
    { id: "e1", source: "greeting", target: "order" },
    { id: "e2", source: "greeting", target: "pricing" },
    { id: "e3", source: "greeting", target: "callback" },
    { id: "e4", source: "greeting", target: "agent" }
  ]
};

export default flowData;
