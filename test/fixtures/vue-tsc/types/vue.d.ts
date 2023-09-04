import 'vue';

declare module 'vue' {
    export interface GlobalComponents {
        MyComponent: typeof import('../components/my-component.vue').default;
    }
}
