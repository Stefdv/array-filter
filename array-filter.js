(function() {
        class ArrayFilter extends Polymer.Element {
            static get properties() {
                return {
                    /*
                     * An array containing items to be filtered/sorted
                     */
                    items: {
                        type: Array,
                        notify: true
                    },
                    /*
                     * The `items` array after having any filter/sort applied
                     */
                    filtered: {
                        type: Array,
                        notify: true
                    },
                    /*
                     * A space-separated list of paths to observe in children.
                     * When one or more of these paths change in a child, the
                     * child will be re-sorted/re-filtered.
                     */
                    observe: {
                        type: String
                    },
                    /*
                     * A function or the name of a method to be used for
                     * filtering the `items` array.
                     */
                    filter: {
                        type: Function,
                        observer: '_filterChanged'
                    },
                    /*
                     * A function or the name of a method to be used for
                     * sorting the `items` array.
                     */
                    sort: {
                        type: Function,
                        observer: '_sortChanged'
                    }
                };
            }

            static get observers() {
                return [
                    '_itemsChanged(items.*)'
                ];
            }

            constructor() {
                super();
                this._filterDebouncer = null;
            }

            _sortChanged(val) {
                var host = this.getRootNode().host;
                var sort = val;

                if(!sort) {
                    sort = undefined;
                } else {
                    if(typeof val !== 'function') {
                        sort = function() {
                            return host[val].apply(host, arguments);
                        };
                    }
                }

                this._sortFn = sort;

                if(this.items) {
                    this._debounceFilter();
                }
            }

            _debounceFilter() {
                this._filterDebouncer = Polymer.Debouncer.debounce(
                    this._filterDebouncer,
                    Polymer.Async.microTask,
                    this._filter.bind(this));
            }

            _filterChanged(val) {
                var host = this.getRootNode().host;
                var filter = val;

                if(!filter) {
                    filter = undefined;
                } else {
                    if(typeof filter !== 'function') {
                        filter = function() {
                            return host[val].apply(host, arguments);
                        };
                    }
                }

                this._filterFn = filter;

                if(this.items) {
                    this._debounceFilter();
                }
            }

            _itemsChanged(change) {
                var path = change.path;

                if(path === 'items') {
                    this._debounceFilter();
                } else if(path === 'items.length') {
                } else if(path === 'items.splices') {
                    this._computeSplices(change.value.keySplices, change.value.indexSplices);
                } else {
                    this._checkSort(change.path);
                }
            }

            _resetLinks() {
                if(this.filtered) {
                    var item, idx;
                    for(var i = 0; i < this.items.length; i++) {
                        item = this.items[i];
                        this.unlinkPaths('items.' + i);
                        idx = this.filtered.indexOf(item);
                        if(idx !== -1) {
                            this.linkPaths(
                                'items.' + i,
                                'filtered.' + idx
                            );
                        }
                    }
                }
            }

            _filter() {
                this.filtered = this._computeFiltered(this.items);
                this._resetLinks();
            }

            /*
             * Forces filter/sort to be re-applied asynchronously
             * @method update
             */
            update() {
                this._debounceFilter();
            }

            _computeFiltered(base) {
                if(!base) {
                    return;
                }

                var result = base.slice(0);

                if(this._filterFn) {
                    result = result.filter(this._filterFn);
                }

                if(this._sortFn) {
                    result = result.sort(this._sortFn);
                }

                return result;
            }

            _computeSplices(keys, index) {
                index.forEach(function(splice) {
                    var filtered = this._computeFiltered(splice.object);
                    var inserts = [];
                    var item;

                    splice.removed.forEach(function(remove) {
                        this.splice('filtered',
                            this.filtered.indexOf(remove), 1);
                    }.bind(this));

                    for(var i = 0; i < splice.addedCount; i++) {
                        item = splice.object[splice.index + i];
                        if(filtered.indexOf(item) !== -1) {
                            inserts.push([item, filtered.indexOf(item)]);
                        }
                    }

                    inserts.sort(function(a, b) {
                        return a[1] - b[1];
                    }).forEach(function(insert) {
                        this.splice('filtered', insert[1], 0, insert[0]);
                    }.bind(this));
                }.bind(this));

                this._resetLinks();
            }

            _applyObserver(path) {
                var parts = path.split('.');
                var filtered = this._computeFiltered(this.items);
                var item = this.items[parseInt(parts[1])];
                var currentIdx = this.filtered.indexOf(item);
                var newIdx = filtered.indexOf(item);

                if(currentIdx !== newIdx) {
                    if(currentIdx !== -1) {
                        this.unlinkPaths('filtered.' + currentIdx);
                        this.splice('filtered', currentIdx, 1);
                    }

                    if(newIdx !== -1) {
                        this.splice(
                            'filtered',
                            newIdx,
                            0,
                            item
                        );
                    }
                }

                this._resetLinks();
            }

            _checkSort(path) {
                var parts = path.split('.');
                var key = parts[1];

                if(this.observe && (this.sort || this.filter)) {
                    if(parts.length <= 2) {
                        this._debounceFilter();
                    } else {
                        var tail = parts.slice(2).join('.');
                        var observe = this.observe.split(' ');
                        var matches = observe.some(function(p) {
                            // TODO: Use Polymer.Path when it exists
                            return (tail === p) ||
                                    tail.indexOf(p + '.') === 0 ||
                                    p.indexOf(tail + '.') === 0;
                        });
                        if(matches) {
                            this._applyObserver(path);
                        }
                    }
                }
            }
        }
        customElements.define('array-filter', ArrayFilter);
    })();
