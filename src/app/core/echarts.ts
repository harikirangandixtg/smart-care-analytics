// Tree-shaken ECharts build: only the chart types the VisualizationSpec contract supports.
import * as echarts from 'echarts/core';
import { BarChart, BoxplotChart, FunnelChart, GaugeChart, HeatmapChart, LineChart, PieChart, SankeyChart } from 'echarts/charts';
import {
  AriaComponent, DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent,
  TitleComponent, TooltipComponent, VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart, BarChart, PieChart, HeatmapChart, SankeyChart, FunnelChart, GaugeChart, BoxplotChart,
  GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, DataZoomComponent,
  MarkLineComponent, MarkPointComponent, TitleComponent, AriaComponent, CanvasRenderer,
]);

export { echarts };
