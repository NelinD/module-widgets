CMS.controllers.add(['widget.get.index'], function () {
    Api.get('/api.snippet.xeditable', {}, function (resp) {
        $('.editable-template').editable({
            type: 'select2',
            title: i18n.t('widgets.core.field.template'),
            send: 'always',
            defaultValue: 0,
            highlight: false,
            emptytext: i18n.t('cms.core.label.not_set'),
            ajaxOptions: {
                dataType: 'json'
            },
            params: function (params) {
                params.widget_id = $(this).closest('tr').data('id');
                params.template = params.value;

                return params;
            },
            url: function (params) {
                var d = new $.Deferred;
                var response = Api.post('/api.widget.set.template', params, null, false).responseJSON;

                if (response.code != 200) {
                    return d.reject(response.message);
                } else {
                    d.resolve();
                    return d.promise();
                }
            },
            source: resp,
            select2: {
                width: 200
            },
            success: function (response, newValue) {
            }
        });
    });
});

CMS.controllers.add('page.get.edit', function () {
    var layout_file = PAGE.layout;

    reload_blocks(layout_file);
    $('body').on('get:api.layout.rebuild', function (e, response) {
        reload_blocks(layout_file);
    });

    new Vue({
        el: '#page-widgets',
        data: function() {
            this.widgets = {};

            return {
                widgets: this.widgets
            }
        },
        methods: {
            hasWidgets: function() {
                return _.size(this.widgets) > 0;
            },
            groupHasWidgets: function(widgets) {
                return _.size(widgets) > 0;
            },
            openPopup: function() {
                this.$http.get(Api.parseUrl('/api.page.widgets'), {page_id: PAGE.id}).then(function (response) {
                    this.widgets = response.data.content;
                    $('#widgetsPopupList').modal('show');
                });
            },
            place: function(widget) {
                Api.put('/api.widget', {widget_id: widget.id, page_id: PAGE.id}, function (response) {
                    $('#widgetsPopupList').modal('hide');

                    $('#widget-list tbody').append(response.content);
                    reload_blocks(PAGE.layout);

                    CMS.ui.init('icon');
                });
            }
        }
    });
});

CMS.controllers.add('widget.get.edit', function () {
    load_snippets();
    var cache_enabled = function () {
        var $caching_input = $('#cache');
        var $cache_lifetime = $('#cache_lifetime');

        $cache_lifetime.prop('disabled', !$caching_input.prop('checked'));

        if ($caching_input.prop('checked'))
            $('#cache_settings_container').show();
        else
            $('#cache_settings_container').hide();

        higlight_cache_time();
    };

    $('#cache').on('change', cache_enabled).change();

    $('#cache_lifetime').on('keyup', function () {
        higlight_cache_time();
    });

    function higlight_cache_time() {
        $('#cache_lifetime_labels .label')
            .each(function () {
                if ($('#cache_lifetime').val() == $(this).data('value'))
                    $(this).addClass('label-success');
            });
    };
});

CMS.controllers.add('widget.get.location', function () {
    reload_blocks();

    $('body').on('get:api.layout.rebuild', function (e, response) {
        reload_blocks();
    });

    $('#select_for_all').on('click', function () {
        var value = $('input[name="select_for_all"]').val();
        if (!value.length) return false;

        $('select.widget-blocks').each(function () {
            var $options = $(this).data('blocks');
            for (i in $options) {
                var $option = $options[i];
                if ($option['id'].indexOf(value) > -1 || $option['text'].indexOf(value) > -1)
                    $(this).val($option['id']).trigger('change');
            }
        });

        return false;
    });

    $('.set_to_inner_pages').on('click', function () {
        var cont = $(this).closest('tr');

        var block_name = cont.find('.widget-blocks').val();
        var position = cont.find('input.widget-position').val();
        var id = cont.data('id');

        $('.table tbody tr[data-parent-id="' + id + '"]').each(function () {
            var $select = $(this).find('select.widget-blocks');

            if ($select.find('option[value=' + block_name + ']').length) {
                $select.val(block_name).trigger('change');
            }

            $(this).find('input.widget-position').val(position);
        });
        return false;
    });
});

CMS.controllers.add('widget.get.template', function () {
    $('#textarea_content').on('filter:switch:on', function (e, editor) {
        $('#content').setHeightFor('#textarea_contentDiv', {
            contentHeight: true,
            updateOnResize: true,
            offset: 30,
            minHeight: 300,
            onCalculate: function (a, h) {
                CMS.filters.exec('textarea_content', 'changeHeight', h);
            },
            onResize: function (a, h) {
                CMS.filters.exec('textarea_content', 'changeHeight', h);
            }
        });
    });

    CMS.filters.switchOn('textarea_content', DEFAULT_CODE_EDITOR, $('#textarea_content').data());
});

function format_dropdown_block(state, container) {
    if (!state.id) return state.text; // optgroup

    if (state.id == -1 || state.id == 0 || state.id == 'PRE' || state.id == 'POST') {
        container.css({'color': 'blue', 'fontWeight': 'bold'});
    } else {
        container.css({'color': 'green', 'fontWeight': 'bold'});
    }

    return state.text;
}

function reload_blocks($layout) {
    var FILLED_BLOCKS = [],
        LAYOUT_BLOCKS = {},
        LAYOUT_DATA = $layout ? {layout: $layout} : {};

    Api.get('/api.layout.blocks', LAYOUT_DATA, function (resp) {
        if (!resp.content) return;

        LAYOUT_BLOCKS = resp.content;

        $('.widget-blocks').each(function () {
            var cb = $(this).val();
            var layout_name = $(this).data('layout');
            if (!LAYOUT_BLOCKS[layout_name]) return;

            var blocks = [];
            for (var block in LAYOUT_BLOCKS[layout_name]) {
                if (!FILLED_BLOCKS[block] || (FILLED_BLOCKS[block] && block == cb))
                    blocks.push({id: block, text: LAYOUT_BLOCKS[layout_name][block]});
            }

            var found = false;
            for (var i in blocks) {
                if (blocks[i].id == cb)
                    found = true;
            }

            if (!found) {
                cb = -1;
            }

            $(this)
                .select2({
                    data: blocks,
                    formatSelection: format_dropdown_block,
                    formatResult: format_dropdown_block
                })
                .val(cb)
                .trigger('change.select2');
        });
    });
}

function load_snippets(intervalID) {
    clearInterval(intervalID);
    $('#snippet-select').on('select2:opening', function (e, a) {
        var response = Api.get('/api.snippet.list', {}, false, false).responseJSON;
        var self = $(this);
        if (response.content) {
            $('option', this).remove();

            for (key in response.content)
                self.append($('<option>', {value: key, text: response.content[key]}));
        }

        self.off('select2:opening');
        var intervalID = setInterval(function () {
            load_snippets(intervalID);
        }, 10000);
    });
}
