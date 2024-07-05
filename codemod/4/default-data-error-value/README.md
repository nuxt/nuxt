# Feature Documentation: Updating `null` Comparisons to `undefined`

## Overview

Default `data` and `error` values in `useAsyncData` and `useFetch`


### What Changed

The `data` and `error` objects returned from `useAsyncData` and `useFetch` will now default to `undefined`.

## Before and After Examples

### Before

```javascript
const { data, error } = useAsyncData(
    () => client.value.v1.lists.$select(list.value).fetch(),
    {
        default: () => shallowRef(),
    },
);

if (data.value === null) {
    // Handle case where data is null
}

let x = data.value === null ? "No Data" : error.value === null ? "Error" : "Data Available";
```


### After
```javascript
const { data, error } = useAsyncData(
    () => client.value.v1.lists.$select(list.value).fetch(),
    {
        default: () => shallowRef(),
    },
);

if (data.value === undefined) {
    // Handle case where data is undefined
}

let x = data.value === undefined ? "No Data" : error.value === undefined ? "Error" : "Data Available";
