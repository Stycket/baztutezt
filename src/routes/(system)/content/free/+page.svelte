<script>
    import { session } from '$lib/stores';

    
    const features = [
      {
        icon: '🔒',
        title: 'Basic Backup',
        description: 'Simple and reliable backup solution'
      },
      {
        icon: '💾',
        title: '5GB Storage',
        description: 'Enough space for essential files'
      },
      {
        icon: '📧',
        title: 'Email Support',
        description: 'Basic email support for your needs'
      }
    ];
  </script>
  
  <div class="free-container">
    <div class="max-w-4xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold mb-2">Free Plan Dashboard</h1>
      <p class="text-gray-600 mb-8">Welcome to your basic backup solution</p>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        {#each features as feature}
          <div class="feature-card">
            <div class="text-4xl mb-4">{feature.icon}</div>
            <h3 class="text-xl font-semibold mb-2">{feature.title}</h3>
            <p class="text-gray-600">{feature.description}</p>
          </div>
        {/each}
      </div>
      
      <div class="mt-12 text-center">
        <a href="/subscribe" class="upgrade-button">
          Upgrade for More Features
        </a>
      </div>
    </div>
  </div>
  
  <style>
    .free-container {
      background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
      min-height: calc(100vh - 64px);
    }
    
    .feature-card {
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      text-align: center;
      transition: transform 0.2s;
    }
    
    .feature-card:hover {
      transform: translateY(-5px);
    }
    
    .upgrade-button {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: #2563eb;
      color: white;
      border-radius: 0.5rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .upgrade-button:hover {
      background: #1d4ed8;
      transform: scale(1.05);
    }
  </style>