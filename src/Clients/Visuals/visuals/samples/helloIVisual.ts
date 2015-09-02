﻿module powerbi.visuals.samples {
    export interface HelloViewModel {
        text: string;
        color: string;
        size: number;
        toolTipInfo: TooltipDataItem[];
    }

    export class HelloIVisual implements IVisual {
        public static capabilities: VisualCapabilities = {
            dataRoles: [{
                name: 'Values',
                kind: VisualDataRoleKind.GroupingOrMeasure
            }],
            dataViewMappings: [{
                table: {
                    rows: {
                        for: { in: 'Values' },
                        dataReductionAlgorithm: { window: { count: 100 } }
                    },
                    rowCount: { preferred: { min: 1 } }
                },
            }],
            objects: {
                general: {
                    displayName: data.createDisplayNameGetter('Visual_General'),
                    properties: {
                        fill: {
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Fill'
                        },
                        size: {
                            type: { numeric: true },
                            displayName: 'Size'
                        }
                    },
                }
            },
        };

        private static DefaultText = 'Invalid DV';
        private root: D3.Selection;
        private svgText: D3.Selection;
        private dataView: DataView;

        public static converter(dataView: DataView): HelloViewModel {
            var viewModel: HelloViewModel = {
                size: HelloIVisual.getSize(dataView),
                color: HelloIVisual.getFill(dataView).solid.color,
                text: HelloIVisual.DefaultText,
                toolTipInfo: [{
                    displayName: 'Test',
                    value: '1...2....3... can you see me? I am sending random strings to the tooltip',
                }]
            };
            var table = dataView.table;
            if (!table) return viewModel;

            viewModel.text = table.rows[0][0];

            return viewModel;
        }

        public init(options: VisualInitOptions): void {
            this.root = d3.select(options.element.get(0))
                .append('svg')
                .classed('hello', true);

            this.svgText = this.root
                .append('text')
                .style('cursor', 'pointer')
                .attr('text-anchor', 'middle');
        }

        public update(options: VisualUpdateOptions) {
            if (!options.dataViews && !options.dataViews[0]) return;
            var dataView = this.dataView = options.dataViews[0];
            var viewport = options.viewport;
            var viewModel: HelloViewModel = HelloIVisual.converter(dataView);

            this.root.attr({
                'height': viewport.height,
                'width': viewport.width
            });

            var textProperties = {
                fontFamily: 'tahoma',
                fontSize: viewModel.size + 'px',
                text: viewModel.text
            };
            var textHeight = TextMeasurementService.estimateSvgTextHeight(textProperties);

            this.svgText.style({
                'fill': viewModel.color,
                'font-size': textProperties.fontSize,
                'font-family': textProperties.fontFamily,
            }).attr({
                'y': viewport.height / 2 + textHeight / 3 + 'px',
                'x': viewport.width / 2,
                }).text(viewModel.text).data([viewModel]);

            TooltipManager.addTooltip(this.svgText, (tooltipEvent: TooltipEvent) => tooltipEvent.data.toolTipInfo);
        }

        private static getFill(dataView: DataView): Fill {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                        var fill = <Fill>general['fill'];
                        if (fill)
                            return fill;
                    }
                }
            }
            return { solid: { color: 'red' } };
        }

        private static getSize(dataView: DataView): number {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                        var size = <number>general['size'];
                        if (size)
                            return size;
                    }
                }
            }
            return 100;
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
            var instances: VisualObjectInstance[] = [];
            var dataView = this.dataView;
            switch (options.objectName) {
                case 'general':
                    var general: VisualObjectInstance = {
                        objectName: 'general',
                        displayName: 'General',
                        selector: null,
                        properties: {
                            fill: HelloIVisual.getFill(dataView),
                            size: HelloIVisual.getSize(dataView)
                        }
                    };
                    instances.push(general);
                    break;
            }

            return instances;
        }

        public destroy(): void {
            this.root = null;
        }
    }
}