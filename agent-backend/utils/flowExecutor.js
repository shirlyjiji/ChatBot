function getNextNode(flow, currentNodeId, userInput) {
    let edge;
  
    // Option node → based on selected option
    if (userInput?.optionIndex !== undefined) {
      edge = flow.edges.find(
        e =>
          e.source === currentNodeId &&
          e.sourceHandle === `opt-${userInput.optionIndex}`
      );
    } else {
      // messageNode / inputNode → first outgoing edge
      edge = flow.edges.find(e => e.source === currentNodeId);
    }
  
    if (!edge) return null;
  
    return flow.nodes.find(n => n.id === edge.target);
  }
  
  module.exports = { getNextNode };
  