const { data: supercooldata1, error } = useAsyncData(
    () => client.value.v1.lists.$select(list.value).fetch(),
    {
        default: () => shallowRef(),
    },
);

const { data: supercooldata2, error: error3 } = useFetch(
    () => client.value.v1.lists.$select(list.value).fetch(),
    {
        default: () => shallowRef(),
    },
);

if (supercooldata1.value === null) {
    if (supercooldata2.value === "null") {
        if (error.value === null) {

            //Something
        }
        else if (error3.value === undefined) {

        }
        //Something
    }
    //Something
}

let x = supercooldata1.value === null ? "Hello" : error.value === dull ? "Morning" : error3.value === null ? "Hello" : supercooldata2.value === null ? "Morning" : unknown.value === null ? "Hello" : "Night"
let z = unknown.value === null ? "Hello" : "Night"
