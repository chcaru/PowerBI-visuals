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

    export interface VoronoiMapDataPolygon extends D3.Geom.Polygon {
        point?: MapBubble;
    }

    export class MapVoronoiDataPointRenderer extends MapBubbleDataPointRenderer {

        public updateInternal(data: MapData, viewport: IViewport, dataChanged: boolean): MapBehaviorOptions {

            if (this.svg) {
                this.svg
                    .style("width", viewport.width.toString() + "px")
                    .style("height", viewport.height.toString() + "px");
            }
            if (this.clearSvg) {
                this.clearSvg
                    .style("width", viewport.width.toString() + "px")
                    .style("height", viewport.height.toString() + "px");
            }

            var hasSelection = false;

            if (dataHasSelection(data.bubbleData))
                hasSelection = true;
            if (!hasSelection) {
                for (var i = 0, ilen = data.sliceData.length; i < ilen; i++) {
                    if (dataHasSelection(data.sliceData[i]))
                        hasSelection = true;
                }
            }

            var voronoi = d3.geom.voronoi()
                .x((d: MapBubble) => d.x)
                .y((d: MapBubble) => d.y)
                .clipExtent([[0, 0], [viewport.width, viewport.height]]);
            
            var voronoiPolygons = voronoi(data.bubbleData);

            var maxRadius = _.max(data.bubbleData, d => d.radius).radius;

            var line = d3.svg.line()
                .x(d => d[0])
                .y(d => d[1]);

            var polyPath = this.bubbleGraphicsContext
                .selectAll("path")
                .data(voronoiPolygons, d => line(d));

            polyPath.enter().append("path")
                .style({
                    'stroke-width': '2px',
                    'stroke': (d: VoronoiMapDataPolygon) => d.point.fill,
                    'fill': (d: VoronoiMapDataPolygon) => d.point.fill,
                    'fill-opacity': (d: VoronoiMapDataPolygon) => d.point.radius / maxRadius * ColumnUtil.getFillOpacity(d.point.selected, false, hasSelection, false)
                })
                .attr('d', d => line(d));

            polyPath.order();

            polyPath.exit().remove();

            var markers = this.bubbleGraphicsContext
                .selectAll(".bubble")
                .data(data.bubbleData, (d: MapBubble) => d.identity.getKey());

            markers.enter()
                .append('circle')
                .classed('bubble', true);

            markers
                .style({
                    //'stroke-width': '1px',
                    //'stroke': (d: MapBubble) => d.fill,
                    'fill': (d: MapBubble) => d.fill,
                    'fill-opacity': (d: MapBubble) => ColumnUtil.getFillOpacity(d.selected, false, hasSelection, false)  
                })
                .attr({
                    r: d => d.radius / 2,
                    cx: d => d.x, 
                    cy: d => d.y,
                });

            markers.exit().remove();

            TooltipManager.addTooltip(markers, (tooltipEvent: TooltipEvent) => tooltipEvent.data.tooltipInfo);

            var sliceData = data.sliceData;
            var allData: SelectableDataPoint[] = data.bubbleData.slice();
            for (var i = 0, ilen = sliceData.length; i < ilen; i++) {
                allData.push.apply(allData, sliceData[i]);
            }

            var behaviorOptions: MapBehaviorOptions = {
                bubbles: markers,
                slices: this.sliceGraphicsContext.selectAll("path"),
                clearCatcher: this.clearCatcher,
                dataPoints: allData,
            };
            return behaviorOptions;
        }

    }
}