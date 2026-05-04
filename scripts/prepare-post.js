const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Load config
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/config.json'), 'utf8'));

function generateInstagramCaption(deal) {
  const discount = deal.originalPrice
    ? Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100)
    : 25; // Default discount if not available

  let caption = `🔥 ${deal.name.substring(0, 80)}${deal.name.length > 80 ? '...' : ''} - ${discount}% OFF!\n\n`;
  caption += `💰 Now $${deal.price.toFixed(2)}\n`;
  caption += `⭐ ${deal.rating} stars (${deal.reviewCount?.toLocaleString() || 'N/A'} reviews)\n\n`;
  caption += `🚨 Comment "LINK" & I'll send you the direct Amazon link\n\n`;
  caption += `Follow @topdealzzdaily for daily Amazon deals you don't want to miss! 👇\n\n`;
  caption += config.instagramConfig.hashtags.map(tag => `#${tag}`).join(' ');

  return caption;
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    protocol.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function preparePostForDeal(dealId) {
  try {
    // Load deals
    const dealsFile = path.join(__dirname, '../data/deals.json');
    const deals = JSON.parse(fs.readFileSync(dealsFile, 'utf8'));

    // Find the deal
    const deal = deals.find(d => d.id === dealId || d.asin === dealId);
    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    console.log(`📝 Preparing post for: ${deal.name}`);

    // Generate caption
    const caption = generateInstagramCaption(deal);

    // Download image
    const imageFilename = `${deal.asin}_${Date.now()}.jpg`;
    const imagePath = path.join(__dirname, '../images/deals', imageFilename);

    console.log('📷 Downloading product image...');
    await downloadImage(deal.imageUrl, imagePath);

    // Create post data
    const postData = {
      dealId: deal.id,
      asin: deal.asin,
      productName: deal.name,
      caption: caption,
      imagePath: imagePath,
      imageFilename: imageFilename,
      dealUrl: deal.url,
      price: deal.price,
      preparedAt: new Date().toISOString()
    };

    // Save to prepared posts
    const preparedFile = path.join(__dirname, '../data/prepared_posts.json');
    let preparedPosts = [];
    if (fs.existsSync(preparedFile)) {
      preparedPosts = JSON.parse(fs.readFileSync(preparedFile, 'utf8'));
    }
    preparedPosts.push(postData);
    fs.writeFileSync(preparedFile, JSON.stringify(preparedPosts, null, 2));

    console.log('✅ Post prepared successfully!');
    console.log(`📋 Caption length: ${caption.length} characters`);
    console.log(`🖼️  Image saved: ${imagePath}`);

    return postData;

  } catch (error) {
    console.error('❌ Error preparing post:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const dealId = process.argv[2];
  if (!dealId) {
    console.error('Usage: node prepare-post.js <dealId>');
    process.exit(1);
  }

  preparePostForDeal(dealId)
    .then(post => {
      console.log('\n📱 READY TO POST ON INSTAGRAM:');
      console.log('1. Open Instagram app');
      console.log(`2. Upload image: ${post.imagePath}`);
      console.log('3. Copy this caption:\n');
      console.log('─'.repeat(50));
      console.log(post.caption);
      console.log('─'.repeat(50));
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}

module.exports = { preparePostForDeal, generateInstagramCaption };
