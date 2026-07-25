export type ProductDef = {
    code: string;
    slug: string;
    title: string;
    description: string;
    appUrl: string;
    internal?: boolean;
    unlaunched?: boolean;
    isBundle?: boolean;
    consultingOnly?: boolean;
};
export declare const PRODUCT_CATALOG: ProductDef[];
export declare function findProductByCode(code: string): ProductDef | null;
export declare function findProductBySlug(slug: string): ProductDef | null;
//# sourceMappingURL=catalog.d.ts.map