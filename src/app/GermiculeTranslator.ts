/**
 *
 * GermiculeTranslator
 *
 */

import {
  GermiculeItem,
  GermiculeMeta,
  GermiculeNode,
  GermiculeCluster,
  GraphThemeDef,
} from '../types/Germicule';
import {
  GraphInfo as EChartGraphInfo,
  GraphNode as EChartGraphNode,
  GraphEdge as EChartGraphEdge,
} from '../types/EChartGraph';
import {
  GraphInfo as D3GraphInfo,
  GraphNode as D3GraphNode,
  GraphEdge as D3GraphEdge,
} from '../types/D3Graph';
import {
  GraphCluster,
  GraphInfo,
  GraphEdge as BaseGraphEdge,
  GraphNode as BaseGraphNode,
} from '../types/Graph';

export const defaultCategory = 'unknown';

export const DEFAULT_THEME: GraphThemeDef = {
  background: '#fdf6e3',
  risks: new Map<number, string>([
    [0, '#859900'] /* green */,
    [1, '#2aa198'] /* cyan */,
    [2, '#268bd2'] /* blue */,
    [3, '#6c71c4'] /* violet */,
    [4, '#d33682'] /* magenta */,
    [5, '#dc322f'] /* red */,
  ]),
}; /* base3 */

export abstract class GermiculeTranslator<
  GraphNode extends BaseGraphNode,
  GraphEdge extends BaseGraphEdge
> {
  theme: GraphThemeDef = DEFAULT_THEME;

  constructor(theme?: GraphThemeDef) {
    if (theme) this.theme = theme;
  }

  unknownLabel: string = '❓';
  unknownCount: number = 0;
  getNextUnknown() {
    return this.unknownCount++;
  }

  clusterCount: number = 0;
  clustersSeen = new Map<string, number>();

  getClusterId(name: string) {
    if (!this.clustersSeen.has(name)) {
      this.clustersSeen.set(name, this.clusterCount++);
      return this.clusterCount;
    }
    return this.clustersSeen.get(name);
  }

  getDefaultNode(): Partial<GraphNode> {
    throw new Error(`getDefaultNode(): Partial<GraphNode> not implemented`);
  }

  defaultEdge: Partial<GraphEdge> = {};
  defaultClusterEdge: Partial<GraphEdge> = {};

  defaultCategoryInfo: Partial<GraphCluster> = {};

  toNode(item: GermiculeItem): GraphNode {
    throw new Error('toNode(item: GermiculeItem): GraphNode not implemented');
  }

  toPartialEdge(item: GermiculeItem, target: string): Partial<GraphEdge> {
    throw new Error(
      'toPartialEdge(item: GermiculeItem, target: string): Partial<GraphEdge> not implemented',
    );
  }

  getNodeIdentifier(node: GraphNode): string {
    throw new Error(
      'getNodeIdentifier(node: GraphNode): string not implemented',
    );
  }

  setNodeClusterID(node: GraphNode, clusterID: number): void {
    throw new Error(
      'getNodeIdentifier(node: GraphNode): string not implemented',
    );
  }

  isValidRisk(risk: number): boolean {
    return Math.ceil(risk) < Array.from(this.theme.risks.keys()).length;
  }

  edgeName(source: string, target: string): string {
    return `${source} > ${target}`;
  }

  buildGraph(
    members: Array<GermiculeItem>,
    accumulator: GraphInfo<GraphNode, GraphEdge>,
  ): void {
    const parentPartialEdges: Partial<GraphEdge[]> = [];
    members.forEach((member: GermiculeItem) => {
      if (!member) return;
      if ('link' in member) {
        parentPartialEdges.push(
          this.toPartialEdge(member, member.link) as GraphEdge,
        );
        return;
      }
      if ('germicule' in member) {
        this.buildGraph(member.germicule, accumulator);
      }
      const node: GraphNode = this.toNode(member);
      const source = this.getNodeIdentifier(node);
      while (accumulator.partialEdges.length) {
        const partialEdge = accumulator.partialEdges.pop();
        if (!partialEdge) return;
        const edgeName = this.edgeName(source, partialEdge.target);
        if (accumulator.edges.has(edgeName)) {
          return;
        }
        accumulator.edges.set(edgeName, {
          ...partialEdge,
          source: this.getNodeIdentifier(node),
        } as GraphEdge);
      }
      if ('cluster' in member) {
        if (!accumulator.clusters.has(member.cluster!)) {
          accumulator.clusters.set(member.cluster!, {
            name: member.cluster,
            members: [],
            id: this.getClusterId(member.cluster!),
          } as GraphCluster);
        }
        const cluster: GraphCluster = accumulator.clusters.get(
          member.cluster!,
        )!;
        if (cluster.members === undefined) {
          cluster.members = [];
        }
        cluster.members!.forEach(clusterMember => {
          const edgeName = this.edgeName(source, clusterMember);
          if (accumulator.edges.has(edgeName)) return;
          accumulator.edges.set(edgeName, {
            ...this.defaultClusterEdge,
            source: this.getNodeIdentifier(node),
            target: clusterMember,
          } as GraphEdge);
        });
        cluster.members!.push(this.getNodeIdentifier(node));
        this.setNodeClusterID(node, cluster.id);
      }
      parentPartialEdges.push(
        this.toPartialEdge(member, this.getNodeIdentifier(node)) as GraphEdge,
      );
      accumulator.nodes.push(node);
    });
    accumulator.partialEdges.push(...parentPartialEdges);
  }

  getAccumulator(data?: GermiculeMeta): GraphInfo<GraphNode, GraphEdge> {
    throw new Error(
      'getAccumulator(data?: GermiculeMeta): GraphInfo<GraphNode, GraphEdge> not implemented',
    );
  }

  toGraphInfo(data: GermiculeMeta): GraphInfo<GraphNode, GraphEdge> {
    const accumulator = this.getAccumulator(data);
    if (data && 'germicules' in data) {
      this.buildGraph(data.germicules, accumulator);
    }
    // console.log('accumulator', accumulator);
    return accumulator;
  }
}

export class GermiculeEChartTranslator extends GermiculeTranslator<
  EChartGraphNode,
  EChartGraphEdge
> {
  symbolSize: number;

  constructor(theme?: GraphThemeDef, symbolSize?: number) {
    super(theme);
    this.symbolSize = symbolSize ? symbolSize : 30;
    this.clustersSeen.set(
      this.defaultCategoryInfo.name,
      this.defaultCategoryInfo.id,
    );
  }

  getNodeIdentifier(node: EChartGraphNode): string {
    return node.name;
  }

  setNodeClusterID(node: EChartGraphNode, clusterID: number): void {
    node.category = clusterID;
  }

  getDefaultNode(): Partial<EChartGraphNode> {
    return {
      name: this.unknownLabel,
      _label: this.unknownLabel,
      symbolSize: this.symbolSize,
      category: this.defaultCategoryInfo.id,
      itemStyle: {
        color: this.theme.background,
      },
    };
  }

  toNode(item: GermiculeItem): EChartGraphNode {
    let partial: Partial<EChartGraphNode> = {
      ...this.getDefaultNode(),
      // _tooltip: JSON.stringify(item),
    };
    if (item === null) {
      return {
        ...partial,
        name: `unknown ${this.getNextUnknown()}`,
      };
    }
    item = item as GermiculeNode;
    const result: EChartGraphNode = {
      ...partial,
      name: item.name,
      _label: item.name,
    };
    if (item.risk && this.isValidRisk(item.risk)) {
      result.value = item.risk;
      result._tooltip = String(item.risk);
      result.symbolSize = this.symbolSize * (1 + (5 - item.risk) / 5);
      result.itemStyle = {
        color: this.theme.risks.get(Math.ceil(item.risk)),
      };
    }
    return result;
  }

  defaultEdge: Partial<EChartGraphEdge> = {
    lineStyle: {
      type: 'solid',
    },
  };
  defaultClusterEdge: Partial<EChartGraphEdge> = {
    lineStyle: {
      type: 'none',
    },
    label: {
      show: false,
    },
  };

  defaultCategoryInfo: GraphCluster = {
    name: defaultCategory,
    members: [],
    id: 0,
  };

  toPartialEdge(item: GermiculeItem, target: string): Partial<EChartGraphEdge> {
    let result: Partial<EChartGraphEdge> = { ...this.defaultEdge, target };
    if (item && 'description' in item) {
      result._label = item.description;
      result._tooltip = item.description;
    } else {
      result.label = { show: false };
    }
    if (item && 'contact' in item && item.contact !== null) {
      result.value = item.contact;
    }
    return result;
  }

  getAccumulator(data?: GermiculeMeta): EChartGraphInfo {
    const result: EChartGraphInfo = {
      nodes: [],
      edges: new Map<string, EChartGraphEdge>(),
      partialEdges: [],
      clusters: new Map<string, GraphCluster>([
        [this.defaultCategoryInfo.name, this.defaultCategoryInfo],
      ]),
    };
    if (!data || data.germicules.length === 0) {
      result.nodes.push({
        ...this.getDefaultNode(),
        _tooltip: 'your germicule is empty',
      } as EChartGraphNode);
      return result;
    }
    if ('clusters' in data) {
      data.clusters?.forEach((cluster: GermiculeCluster) => {
        result.clusters!.set(cluster.name, {
          ...cluster,
          id: this.getClusterId(cluster.name),
        } as GraphCluster);
      });
    }
    return result;
  }
}

export class GermiculeD3Translator extends GermiculeTranslator<
  D3GraphNode,
  D3GraphEdge
> {
  constructor(theme?: GraphThemeDef, symbolSize?: number) {
    super(theme);
  }

  defaultCategoryInfo: GraphCluster = {
    name: defaultCategory,
    members: [],
    id: 0,
  };

  getDefaultNode(): Partial<D3GraphNode> {
    return {
      id: this.unknownLabel,
      group: this.defaultCategoryInfo.id,
    };
  }

  getNodeIdentifier(node: D3GraphNode): string {
    return node.id;
  }

  setNodeClusterID(node: D3GraphNode, clusterID: number): void {
    node.group = clusterID;
  }

  toNode(item: GermiculeItem): D3GraphNode {
    let partial: Partial<D3GraphNode> = {
      ...this.getDefaultNode(),
      // _tooltip: JSON.stringify(item),
    };
    if (item === null) {
      return {
        ...partial,
        _label: `unknown ${this.getNextUnknown()}`,
      } as D3GraphNode;
    }
    item = item as GermiculeNode;
    const result: D3GraphNode = {
      ...partial,
      id: item.name,
      _label: item.name,
    };
    if (item.risk && this.isValidRisk(item.risk)) {
      result.value = item.risk;
      result._tooltip = String(item.risk);
      // result.symbolSize = this.symbolSize * (1 + (5 - item.risk) / 5);
      // result.itemStyle = {
      //   color: this.theme.risks[Math.ceil(item.risk)],
      // };
    }
    return result;
  }

  toPartialEdge(item: GermiculeItem, target: string): Partial<D3GraphEdge> {
    let result: Partial<D3GraphEdge> = { ...this.defaultEdge, target };
    if (item && 'description' in item) {
      result._label = item.description;
      result._tooltip = item.description;
    } else {
      // result.label = { show: false };
    }
    if (item && 'contact' in item && item.contact !== null) {
      result.value = item.contact;
    }
    return result;
  }

  getAccumulator(data?: GermiculeMeta): D3GraphInfo {
    const result: D3GraphInfo = {
      nodes: [],
      edges: new Map<string, D3GraphEdge>(),
      partialEdges: [],
      clusters: new Map<string, GraphCluster>([
        [this.defaultCategoryInfo.name, this.defaultCategoryInfo],
      ]),
    };
    if (!data || data.germicules.length === 0) {
      result.nodes.push({
        ...this.getDefaultNode(),
        _tooltip: 'your germicule is empty',
      } as D3GraphNode);
      return result;
    }
    if ('clusters' in data) {
      data.clusters?.forEach((cluster: GermiculeCluster) => {
        result.clusters!.set(cluster.name, {
          ...cluster,
          id: this.getClusterId(cluster.name),
        } as GraphCluster);
      });
    }
    return result;
  }
}
