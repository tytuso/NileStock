import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog";
export default function sitemap(): MetadataRoute.Sitemap { const base="https://nilestock.shop"; return [ {url:base,changeFrequency:"weekly",priority:1}, {url:`${base}/blog`,changeFrequency:"weekly",priority:.8}, ...BLOG_POSTS.map((post)=>({url:`${base}/blog/${post.slug}`,lastModified:new Date(post.published),changeFrequency:"monthly" as const,priority:.7})), {url:`${base}/privacy`,changeFrequency:"yearly" as const,priority:.3}, {url:`${base}/terms`,changeFrequency:"yearly" as const,priority:.3} ]; }
