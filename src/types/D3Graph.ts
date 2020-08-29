import {
  GraphInfo as BaseGraphInfo,
  GraphEdge as BaseGraphEdge,
  GraphNode as BaseGraphNode,
} from './Graph';

export interface GraphNode extends BaseGraphNode {
  id: string;
  _label?: string;
  _tooltip?: string;
  value?: number;
  group?: number;
}

export interface GraphEdge extends BaseGraphEdge {
  source: string;
  target: string;
  _label?: string;
  _tooltip?: string;
  value?: number;
}

export type GraphInfo = BaseGraphInfo<GraphNode, GraphEdge>;
