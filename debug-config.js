// Debug script to check environment variables and config
console.log("=== Environment Variables Debug ===");
console.log("EXTERNAL_BLOGS:", process.env.EXTERNAL_BLOGS);
console.log("NODE_ENV:", process.env.NODE_ENV);

if (process.env.EXTERNAL_BLOGS) {
  try {
    const parsed = JSON.parse(process.env.EXTERNAL_BLOGS);
    console.log("Parsed EXTERNAL_BLOGS:", parsed);
    console.log("Type:", typeof parsed);
    console.log("Is Array:", Array.isArray(parsed));
    
    if (Array.isArray(parsed)) {
      parsed.forEach((blog, index) => {
        console.log(`Blog ${index}:`, blog);
        console.log(`  - name: ${blog.name} (${typeof blog.name})`);
        console.log(`  - rssUrl: ${blog.rssUrl} (${typeof blog.rssUrl})`);
      });
    }
  } catch (error) {
    console.error("Failed to parse EXTERNAL_BLOGS:", error);
  }
} else {
  console.log("EXTERNAL_BLOGS is not set or empty");
}