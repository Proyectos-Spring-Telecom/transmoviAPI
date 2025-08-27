export interface ApiResponseCommon{
    message:string;
    data:any[];
    paginated?:Paginated;
}

export interface Paginated{
    total:number;
    page:number;
    limit:number;
}