"use server"

import { Prisma } from "@prisma/client";
import { db } from ".";

export async function createData(data:Prisma.DemoCreateInput) {
    try{
     return !!(await db.demo.create({data})) 
    }catch(e){
        console.log(e)
        return false
    }
}

export async function getAllData() {
    try{
     return await db.demo.findMany() 
    }catch(e){
        console.log(e)
        return []
    }
}