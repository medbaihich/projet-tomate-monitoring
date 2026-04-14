from rest_framework.pagination import PageNumberPagination


TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def apply_query_filters(queryset, query_params, field_mapping):
    for param, lookup in field_mapping.items():
        value = query_params.get(param)
        if value in (None, ""):
            continue

        if isinstance(value, str):
            lowered = value.lower()
            if lowered in TRUE_VALUES:
                value = True
            elif lowered in FALSE_VALUES:
                value = False

        queryset = queryset.filter(**{lookup: value})

    return queryset
