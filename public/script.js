let allDeals = [];
let filteredDeals = [];
let displayedDeals = 0;
const DEALS_PER_BATCH = 20;
let isLoading = false;

// Load deals on page load
document.addEventListener('DOMContentLoaded', () => {
    setTodayDate();
    loadDeals();
    setupFilters();
    setupScrollToTop();
    setupInfiniteScroll();
});

function setTodayDate() {
    const today = new Date();
    const options = { month: 'long', day: 'numeric' };
    const dateString = today.toLocaleDateString('en-US', options);
    const todayDeals = document.getElementById('todayDeals');
    todayDeals.textContent = `${dateString} Deals`;
}

async function loadDeals() {
    try {
        const response = await fetch('/api/deals');
        allDeals = await response.json();

        // Filter only non-posted deals for public display
        allDeals = allDeals.filter(deal => deal.status !== 'posted');

        // Initialize with filtered deals
        filteredDeals = allDeals;
        displayedDeals = 0;

        // Display first batch
        displayInitialDeals();
        updateStats();
    } catch (error) {
        console.error('Error loading deals:', error);
        const grid = document.getElementById('dealsGrid');
        grid.textContent = 'Failed to load deals. Please try again later.';
    }
}

function displayInitialDeals() {
    const grid = document.getElementById('dealsGrid');
    grid.innerHTML = ''; // Clear existing content

    if (filteredDeals.length === 0) {
        const message = document.createElement('div');
        message.className = 'loading';
        message.textContent = 'No deals found. Check back soon! 🔄';
        grid.appendChild(message);
        return;
    }

    // Remove loading indicator if exists
    removeLoadingIndicator();

    // Display first batch
    displayedDeals = 0;
    loadMoreDeals();
}

function loadMoreDeals() {
    if (isLoading) return;

    const grid = document.getElementById('dealsGrid');
    const startIndex = displayedDeals;
    const endIndex = Math.min(startIndex + DEALS_PER_BATCH, filteredDeals.length);

    if (startIndex >= filteredDeals.length) {
        return; // No more deals to load
    }

    isLoading = true;

    // Add deals to grid
    for (let i = startIndex; i < endIndex; i++) {
        const deal = filteredDeals[i];
        const card = createDealCard(deal);
        grid.appendChild(card);
    }

    displayedDeals = endIndex;
    isLoading = false;

    // Re-trigger animations for new cards
    setTimeout(() => addCardAnimations(), 100);

    // Add or remove loading indicator
    if (displayedDeals < filteredDeals.length) {
        addLoadingIndicator();
    } else {
        removeLoadingIndicator();
    }
}

function addLoadingIndicator() {
    // Remove existing indicator
    removeLoadingIndicator();

    const indicator = document.createElement('div');
    indicator.className = 'load-more-indicator';
    indicator.id = 'loadMoreIndicator';

    const spinner = document.createElement('div');
    spinner.className = 'load-more-spinner';

    const text = document.createElement('div');
    text.className = 'load-more-text';
    text.textContent = 'Loading more deals...';

    indicator.appendChild(spinner);
    indicator.appendChild(text);

    const main = document.querySelector('main.container');
    main.appendChild(indicator);
}

function removeLoadingIndicator() {
    const indicator = document.getElementById('loadMoreIndicator');
    if (indicator) {
        indicator.remove();
    }
}

function createDealCard(deal) {
    const discount = deal.originalPrice
        ? Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100)
        : 0;

    // Create card elements safely
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.onclick = () => window.open(deal.url, '_blank');

    // Try to load real image, fallback to placeholder
    const imgContainer = document.createElement('div');
    imgContainer.className = 'deal-image-container';

    if (deal.imageUrl) {
        const img = document.createElement('img');
        img.className = 'deal-image';
        img.src = deal.imageUrl;
        img.alt = deal.name;
        img.loading = 'lazy';

        // Fallback to placeholder if image fails
        img.onerror = () => {
            img.remove();
            const placeholder = document.createElement('div');
            placeholder.className = 'deal-image-placeholder';
            const placeholderText = document.createElement('span');
            placeholderText.textContent = `📦 ${deal.category || 'Product'}`;
            placeholder.appendChild(placeholderText);
            imgContainer.appendChild(placeholder);
        };

        imgContainer.appendChild(img);
    } else {
        // No image URL, show placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'deal-image-placeholder';
        const placeholderText = document.createElement('span');
        placeholderText.textContent = `📦 ${deal.category || 'Product'}`;
        placeholder.appendChild(placeholderText);
        imgContainer.appendChild(placeholder);
    }

    const content = document.createElement('div');
    content.className = 'deal-content';

    const category = document.createElement('div');
    category.className = 'deal-category';
    category.textContent = deal.category || 'Amazon';

    const name = document.createElement('h3');
    name.className = 'deal-name';
    name.textContent = deal.name;

    const rating = document.createElement('div');
    rating.className = 'deal-rating';
    const stars = document.createElement('span');
    stars.className = 'stars';
    stars.textContent = `⭐ ${deal.rating || 'N/A'}`;
    const reviews = document.createElement('span');
    reviews.textContent = `(${(deal.reviewCount || 0).toLocaleString()} reviews)`;
    rating.appendChild(stars);
    rating.appendChild(reviews);

    const priceDiv = document.createElement('div');
    priceDiv.className = 'deal-price';

    const priceContainer = document.createElement('div');
    priceContainer.className = 'price-container';

    // Show original price if available
    if (deal.originalPrice && deal.originalPrice > deal.price) {
        const originalPrice = document.createElement('span');
        originalPrice.className = 'original-price';
        originalPrice.textContent = `$${deal.originalPrice.toFixed(2)}`;
        priceContainer.appendChild(originalPrice);
    }

    const currentPrice = document.createElement('span');
    currentPrice.className = 'current-price';
    currentPrice.textContent = `$${deal.price.toFixed(2)}`;
    priceContainer.appendChild(currentPrice);

    priceDiv.appendChild(priceContainer);

    // Only show "HOT DEAL" badge if discount is 10% or more
    if (discount >= 10) {
        const badge = document.createElement('span');
        badge.className = 'deal-badge';
        badge.textContent = `${discount}% OFF`;
        priceDiv.appendChild(badge);
    }

    // Coupon badge — shown above the shop button
    if (deal.couponCode) {
      const couponDiv = document.createElement('div');
      couponDiv.className = 'coupon-badge coupon-code';
      couponDiv.textContent = '🏷️ Use code ';
      const strong = document.createElement('strong');
      strong.textContent = deal.couponCode;
      couponDiv.appendChild(strong);
      const tail = document.createTextNode(' at checkout');
      couponDiv.appendChild(tail);
      content.appendChild(couponDiv);
    } else if (deal.couponType === 'clip') {
      const couponDiv = document.createElement('div');
      couponDiv.className = 'coupon-badge coupon-clip';
      const amtText = deal.couponAmount ? ' ($' + deal.couponAmount.toFixed(2) + ' off)' : '';
      couponDiv.textContent = '✂️ Clip coupon on Amazon page' + amtText;
      content.appendChild(couponDiv);
    } else if (deal.couponType === 'subscribe_save') {
      const couponDiv = document.createElement('div');
      couponDiv.className = 'coupon-badge coupon-sns';
      couponDiv.textContent = '🔁 Extra savings with Subscribe & Save';
      content.appendChild(couponDiv);
    }

    const shopBtn = document.createElement('a');
    shopBtn.href = deal.url;
    shopBtn.className = 'shop-btn';
    shopBtn.target = '_blank';
    shopBtn.textContent = 'Shop Now on Amazon';
    shopBtn.onclick = (e) => e.stopPropagation();

    content.appendChild(category);
    content.appendChild(name);
    content.appendChild(rating);
    content.appendChild(priceDiv);
    content.appendChild(shopBtn);

    card.appendChild(imgContainer);
    card.appendChild(content);

    return card;
}

function updateStats() {
    const dealsCount = document.getElementById('dealsCount');
    dealsCount.textContent = `${filteredDeals.length} deals available`;
}

function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const categoryTabs = document.querySelectorAll('.category-tab');
    const priceOptions = document.querySelectorAll('.price-option');
    const priceFilterBtn = document.getElementById('priceFilterBtn');
    const priceFilterDropdown = document.getElementById('priceFilterDropdown');

    let activeCategory = 'all';
    let activePriceRange = 'all';

    const applyFilters = () => {
        let filtered = [...allDeals];

        // Search filter
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(deal =>
                deal.name.toLowerCase().includes(searchTerm) ||
                (deal.category && deal.category.toLowerCase().includes(searchTerm))
            );
        }

        // Category filter
        if (activeCategory !== 'all') {
            filtered = filtered.filter(deal =>
                deal.category && deal.category.includes(activeCategory)
            );
        }

        // Price filter
        if (activePriceRange !== 'all') {
            const [min, max] = activePriceRange.split('-').map(Number);
            filtered = filtered.filter(deal =>
                deal.price >= min && deal.price <= max
            );
        }

        // Update filtered deals and reset display
        filteredDeals = filtered;
        displayInitialDeals();
        updateStats();
    };

    // Search input listener
    searchInput.addEventListener('input', applyFilters);

    // Category tab listeners
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            categoryTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            // Update active category
            activeCategory = tab.dataset.category;
            // Apply filters
            applyFilters();
        });
    });

    // Price filter button toggle
    priceFilterBtn.addEventListener('click', () => {
        priceFilterDropdown.classList.toggle('show');
    });

    // Price option listeners
    priceOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all options
            priceOptions.forEach(o => o.classList.remove('active'));
            // Add active class to clicked option
            option.classList.add('active');
            // Update active price range
            activePriceRange = option.dataset.price;
            // Apply filters
            applyFilters();
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!priceFilterBtn.contains(e.target) && !priceFilterDropdown.contains(e.target)) {
            priceFilterDropdown.classList.remove('show');
        }
    });
}

function setupScrollToTop() {
    const scrollTopBtn = document.getElementById('scrollTop');

    // Show/hide button based on scroll position
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    });

    // Scroll to top when clicked
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        // Check if user scrolled near bottom
        const scrollPosition = window.innerHeight + window.pageYOffset;
        const pageHeight = document.documentElement.scrollHeight;

        // Load more when within 500px of bottom
        if (scrollPosition >= pageHeight - 500) {
            if (displayedDeals < filteredDeals.length && !isLoading) {
                loadMoreDeals();
            }
        }
    });
}

function addCardAnimations() {
    // Add entrance animations to cards as they come into view
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 30);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all deal cards that haven't been animated yet
    const cards = document.querySelectorAll('.deal-card:not(.animated)');
    cards.forEach(card => {
        card.classList.add('animated');
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(card);
    });
}
