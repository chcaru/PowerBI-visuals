/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved. 
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *   
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *   
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

/// <reference path="../_references.ts"/>

module powerbi.visuals {

    export interface VoronoiChartDataPolygon extends D3.Geom.Polygon {
        point?: ScatterChartDataPoint;
    }

    export interface VoronoiChartData extends ScatterChartData {
        voronoiPolygons?: D3.Geom.Polygon[];
    }

    export class VoronoiChart extends ScatterChart {

        protected voronoiChartData: VoronoiChartData;

        constructor(options: CartesianVisualConstructorOptions) {
            super(options);
            
        }

        public setData(dataViews: DataView[]): void {
            super.setData(dataViews);

            //var stack = d3.layout.stack()
            //    .values((d: LineChartSeries) => d.data)
            //    .x((d: LineChartDataPoint) => this.getXValue(d))
            //    .y((d: LineChartDataPoint) => d.value)
            //    .out((d: StreamChartDataPoint, y0: number, y: number) => {
            //        d.stackedValueBelow = y0;
            //        d.stackedValue = y0 + y;
            //        d.value = d.stackedValue;
            //    });

            //var width = this.currentViewport.width - (this.margin ? (this.margin.left + this.margin.right) : 0);
            //var height = this.currentViewport.height - (this.margin ? (this.margin.top + this.margin.bottom) : 0);

            var voronoi = d3.geom.voronoi()
                .x((d: ScatterChartDataPoint) => d.x)
                .y((d: ScatterChartDataPoint) => d.y);
                //.clipExtent([[0, 0], [width, height]]);

            this.voronoiChartData = this.data;
            var voronoiPolygons = voronoi(this.data.dataPoints);
            this.voronoiChartData.voronoiPolygons = voronoiPolygons;

            //this.data.dataPoints.push([
            //    {
            //        x: d3.max(voronoiPolygons, d => d3.max(d, e => e[0])),
            //        y: d3.max(voronoiPolygons, d => d3.max(d, e => e[1])),
            //        size: {},
            //        radius: 
            //    },
            //    {
            //        x: d3.min(voronoiPolygons, d => d3.max(d, e => e[0])),
            //        y: d3.min(voronoiPolygons, d => d3.max(d, e => e[1]))
            //    }]);
        }

        public render(suppressAnimations: boolean): void {
            if (!this.voronoiChartData)
                return;
            
            var margin = this.margin;
            var viewport = this.currentViewport;
            var width = viewport.width - (margin.left + margin.right);
            var height = viewport.height - (margin.top + margin.bottom);
            var xScale = this.xAxisProperties.scale;
            var yScale = this.yAxisProperties.scale;

            var voronoi = d3.geom.voronoi()
                .x((d: ScatterChartDataPoint) => xScale(d.x))
                .y((d: ScatterChartDataPoint) => yScale(d.y))
                .clipExtent([[0, 0], [width, height]]);

            this.voronoiChartData = this.data;
            var voronoiPolygons = voronoi(this.data.dataPoints);
            this.voronoiChartData.voronoiPolygons = voronoiPolygons;

            var voronoiChartData = this.voronoiChartData;

            var hasSelection = dataHasSelection(voronoiChartData.dataPoints);
            var shouldEnableFill = (!voronoiChartData.sizeRange || !voronoiChartData.sizeRange.min) && voronoiChartData.fillPoint;

            this.mainGraphicsContext.attr('width', width)
                .attr('height', height);
            
            var duration = AnimatorCommon.GetAnimationDuration(this.animator, suppressAnimations);

            var line = d3.svg.line()
                .x(d => d[0])
                .y(d => d[1]);

            var polyPath = this.mainGraphicsContext
                .selectAll("path")
                .data(this.voronoiChartData.voronoiPolygons, d => line(d));
            
            polyPath.enter().append("path")
                .style({
                    'stroke-width': '2px',
                    'stroke': (d: VoronoiChartDataPolygon) => d.point.fill,
                    'fill': (d: VoronoiChartDataPolygon) => d.point.fill,
                    'fill-opacity': (d: VoronoiChartDataPolygon) => (d.point.size != null || shouldEnableFill) ? ScatterChart.getBubbleOpacity(d.point, hasSelection) : 0
                })
                .transition()
                .duration(duration)
                .attr('d', d => line(d));

            polyPath.order();

            polyPath.exit().remove();

            var markers = this.mainGraphicsContext
                .selectAll(ScatterChart.DotClasses.selector)
                .data(voronoiChartData.dataPoints, (d: ScatterChartDataPoint) => d.identity.getKey());

            markers.enter().append(ScatterChart.ScatterChartCircleTagName)
                .classed(ScatterChart.DotClasses.class, true);

            markers
                .style({
                    'stroke-width': '1px',
                    'stroke': (d: ScatterChartDataPoint) => d.fill,
                    'fill': (d: ScatterChartDataPoint) => d.fill
                })
                .transition()
                .duration(duration)
                .attr({
                    r: 3,
                    cx: d => xScale(d.x),
                    cy: d => yScale(d.y),
                });

            markers.exit().remove();

            if (this.data.dataLabelsSettings.show) {
                var layout = dataLabelUtils.getScatterChartLabelLayout(xScale, yScale, voronoiChartData.dataLabelsSettings, viewport, voronoiChartData.sizeRange);
                dataLabelUtils.drawDefaultLabelsForDataPointChart(voronoiChartData.dataPoints, this.mainGraphicsG, layout, this.currentViewport, !suppressAnimations, duration);
            }
            else {
                dataLabelUtils.cleanDataLabels(this.mainGraphicsG);
            }

            if (this.interactivityService) {
                var options: ScatterBehaviorOptions = {
                    host: this.cartesianVisualHost,
                    root: this.svg, 
                    dataPointsSelection: markers,
                    mainContext: this.mainGraphicsContext,
                    data: this.data,
                    visualInitOptions: this.options,
                    xAxisProperties: this.xAxisProperties,
                    yAxisProperties: this.yAxisProperties,
                    background: d3.select(this.element.get(0)),
                    clearCatcher: this.clearCatcher,
                };

                this.interactivityService.apply(this, options);
            }

            TooltipManager.addTooltip(markers, (tooltipEvent: TooltipEvent) => tooltipEvent.data.tooltipInfo);

            SVGUtil.flushAllD3TransitionsIfNeeded(this.options);
        }
    }

}