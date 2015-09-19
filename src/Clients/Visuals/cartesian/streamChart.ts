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

    export interface StreamChartDataPoint extends LineChartDataPoint {
        stackedValue: number;
        stackedValueBelow: number;
    }

    //Implements IVisual to meet rules.
    export class StreamChart extends LineChart implements IVisual {

        protected dataView: DataView;
        protected previousInterpolationMode: string;

        constructor(options: CartesianVisualConstructorOptions) {

            var streamOptions: LineChartConstructorOptions = options;
            streamOptions.chartType = LineChartType.stream;

            this.previousInterpolationMode = null;

            super(streamOptions);
        }

        private static shouldShowGeneralProperty(objects, property: string): boolean {
            return objects && objects.general && objects.general[property] !== false;
        }

        public init(options: VisualInitOptions): void {
            super.init(<CartesianVisualInitOptions>options);
        }

        public setData(dataViews: DataView[]): void {
            super.setData(dataViews);

            this.dataView = dataViews[0];

            var stack = d3.layout.stack()
                .values((d: LineChartSeries) => d.data)
                .x((d: LineChartDataPoint) => this.getXValue(d))
                .y((d: LineChartDataPoint) => d.value)
                .out((d: StreamChartDataPoint, y0: number, y: number) => {
                    d.stackedValueBelow = y0;
                    d.stackedValue = y0 + y;
                    d.value = d.stackedValue;
                }); 

            if (StreamChart.shouldShowGeneralProperty(this.dataView.metadata.objects, 'type')) {
                stack = stack.offset('silhouette');
            }

            this.data.series = stack(this.data.series);
        }

        public calculateAxesProperties(options: CalculateScaleAndDomainOptions): IAxisProperties[]{
            var axes = super.calculateAxesProperties(options);

            axes[1].overrideShow = StreamChart.shouldShowGeneralProperty(this.dataView.metadata.objects, 'type');
             
            return axes; 
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {

            var instances: VisualObjectInstance[] = [];
            
            switch (options.objectName) {
                case 'general':
                    instances.push({
                        objectName: options.objectName,
                        selector: null,
                        properties: {
                            type: StreamChart.shouldShowGeneralProperty(this.dataView.metadata.objects, 'type')
                        }
                    });
                    return instances;

                default: return super.enumerateObjectInstances(options);
            }
        }

        protected renderNew(duration: number): void {
            var data = this.clippedData ? this.clippedData : this.data;
            if (!data)
                return;
          
            var margin = this.margin;
            var viewport = this.currentViewport;
            var height = viewport.height - (margin.top + margin.bottom);

            var xScale = this.xAxisProperties.scale;
            var yScale = this.yAxisProperties.scale;

            var hasSelection = data.hasSelection;
            
            var area = d3.svg.area()
                .x((d: StreamChartDataPoint) => xScale(this.getXValue(d)))
                .y0((d: StreamChartDataPoint) => {
                    var y0 = yScale(d.stackedValueBelow);
                    return y0 <= height ? y0 : height;
                })
                .y1((d: StreamChartDataPoint) => yScale(d.stackedValue))
                .defined((d: StreamChartDataPoint) => d.stackedValue !== null)
                .interpolate('cardinal');
            

            var line = d3.svg.line()
                .x((d: StreamChartDataPoint) => xScale(this.getXValue(d)))
                .y((d: StreamChartDataPoint) => {
                    var y0 = yScale(d.stackedValue);
                    return y0 <= height ? y0 : height;
                })
                .defined((d: StreamChartDataPoint) => d.stackedValue !== null)
                .interpolate('cardinal');
            
            var extraLineShift = this.extraLineShift();

            this.mainGraphicsContext
                .attr('transform', SVGUtil.translate(LineChart.HorizontalShift + extraLineShift, 0));

            this.mainGraphicsContext
                .attr('height', this.getAvailableHeight())
                .attr('width', this.getAvailableWidth());

            this.toolTipContext
                .attr('transform', SVGUtil.translate(LineChart.HorizontalShift + extraLineShift, 0));
            
            var areas = this.mainGraphicsContext.selectAll(LineChart.CategoryAreaClassSelector).data(data.series, (d: LineChartSeries) => d.identity.getKey());
            areas.enter()
                .append(LineChart.PathElementName)
                .classed(LineChart.CategoryAreaClassName, true);

            areas
                .style('fill', (d: LineChartSeries) => d.color)
                .style('fill-opacity', (d: LineChartSeries) => (hasSelection && !d.selected) ? LineChart.DimmedAreaFillOpacity : LineChart.AreaFillOpacity)
                .transition()
                .ease('linear')
                .duration(duration)
                .attr('d', (d: LineChartSeries) => area(d.data));
                
            areas.exit()
                .remove();

            var lineSeries = data.series.splice(0);

            //if (StreamChart.shouldShowGeneralProperty(this.dataView.metadata.objects, 'type')) {
                var bottomSeries = _.min(lineSeries, s => _.reduce(s.data, (i, d) => i + (<StreamChartDataPoint>d).stackedValueBelow, 0));

                var bottomLineSeries: LineChartSeries = {
                    key: bottomSeries.key + bottomSeries.key,
                    lineIndex: lineSeries.length,
                    color: bottomSeries.color,
                    xCol: bottomSeries.xCol,
                    yCol: bottomSeries.yCol,
                    identity: bottomSeries.identity,
                    selected: bottomSeries.selected,
                    data: _.map(bottomSeries.data, d => <StreamChartDataPoint>{
                        categoryValue: d.categoryValue,
                        value: (<StreamChartDataPoint>d).stackedValueBelow,
                        stackedValue: (<StreamChartDataPoint>d).stackedValueBelow,
                        stackedValueBelow: (<StreamChartDataPoint>d).stackedValueBelow,
                        categoryIndex: d.categoryIndex,
                        seriesIndex: lineSeries.length, 
                        key: d.key + d.key
                    })
                };

                lineSeries.push(bottomLineSeries);
            //}

                var lines = this.mainGraphicsContext.selectAll(".line").data(lineSeries, (d: LineChartSeries) => d.key === bottomLineSeries.key ? d.key : d.identity.getKey());
            lines.enter()
                .append(LineChart.PathElementName)
                .classed('line', true);
            lines
                .style('stroke', (d: LineChartSeries) => d.color)
                .style('stroke-opacity', (d: LineChartSeries) => /*StreamChart.shouldShowGeneralProperty(this.dataView.metadata.objects, 'type') ? 0 :*/ ColumnUtil.getFillOpacity(d.selected, false, hasSelection, false))
                .transition()
                .ease('linear')
                .duration(duration)
                .attr('d', (d: LineChartSeries) => line(d.data));
            lines.exit()
                .remove();

            var interactivityLines;
            if (this.interactivityService) {
                interactivityLines = this.mainGraphicsContext.selectAll(".interactivity-line").data(lineSeries, (d: LineChartSeries) => d.key === bottomLineSeries.key ? d.key : d.identity.getKey());
                interactivityLines.enter()
                    .append(LineChart.PathElementName)
                    .classed('interactivity-line', true);
                interactivityLines
                    .attr('d', (d: LineChartSeries) => {
                        return line(d.data);
                    });
                interactivityLines.exit()
                    .remove();
            }

            var dotGroups = this.mainGraphicsContext.selectAll(LineChart.CategoryClassSelector)
                .data(data.series, (d: LineChartSeries) => d.identity.getKey());

            dotGroups.enter()
                .append('g')
                .classed(LineChart.CategoryClassName, true);

            dotGroups.exit()
                .remove();
            
            var dots = dotGroups.selectAll(LineChart.CategoryValuePoint.selector)
                .data((series: LineChartSeries) => {
                    return series.data.filter((value: LineChartDataPoint, i: number) => {
                        return this.shouldDrawCircle(series, i);
                    });
                }, (d: LineChartDataPoint) => d.key);
            dots.enter()
                .append(LineChart.CircleElementName)
                .classed(LineChart.CategoryValuePoint.class, true);
            dots
                .style('fill', function () {
                    var lineSeries = d3.select(this.parentNode).datum();
                    return lineSeries.color;
                })
                .style('fill-opacity', function () {
                    var lineSeries = d3.select(this.parentNode).datum();
                    return ColumnUtil.getFillOpacity(lineSeries.selected, false, hasSelection, false);
                })
                .transition()
                .duration(duration)
                .attr({
                    cx: (d: LineChartDataPoint, i: number) => xScale(this.getXValue(d)),
                    cy: (d: LineChartDataPoint, i: number) => yScale(d.value),
                    r: LineChart.CircleRadius
                });
            dots.exit()
                .remove();

            if (data.dataLabelsSettings.show) {
                var layout = dataLabelUtils.getLineChartLabelLayout(xScale, yScale, data.dataLabelsSettings, data.isScalar, this.yAxisProperties.formatter);
                var dataPoints: LineChartDataPoint[] = [];

                for (var i = 0, ilen = data.series.length; i < ilen; i++) {
                    Array.prototype.push.apply(dataPoints, data.series[i].data);
                }

                dataLabelUtils.drawDefaultLabelsForDataPointChart(dataPoints, this.mainGraphicsSVG, layout, this.currentViewport, duration > 0, duration);
                this.mainGraphicsSVG.select('.labels').attr('transform', SVGUtil.translate(LineChart.HorizontalShift + extraLineShift, 0));
            }
            else {
                dataLabelUtils.cleanDataLabels(this.mainGraphicsSVG);
            }

            if (this.interactivityService) {
                var seriesTooltipApplier = (tooltipEvent: TooltipEvent) => {
                    var pointX: number = tooltipEvent.elementCoordinates[0];
                    return LineChart.getTooltipInfoByPointX(this, tooltipEvent.data, pointX);
                };
                TooltipManager.addTooltip(interactivityLines, seriesTooltipApplier, true);
                TooltipManager.addTooltip(areas, seriesTooltipApplier, true);
                TooltipManager.addTooltip(dots, (tooltipEvent: TooltipEvent) => tooltipEvent.data.tooltipInfo, true);

                var dataPointsToBind: SelectableDataPoint[] = lineSeries.slice();
                for (var i = 0, ilen = data.series.length; i < ilen; i++) {
                    dataPointsToBind = dataPointsToBind.concat(lineSeries[i].data);
                }
                var options: LineChartBehaviorOptions = {
                    dataPoints: dataPointsToBind,
                    lines: lines,
                    interactivityLines: interactivityLines,
                    dots: dots,
                    areas: areas,
                    background: d3.selectAll(this.element.toArray()),
                    clearCatcher: this.clearCatcher,
                };
                this.interactivityService.apply(this, options);
            }
        }
    }
}