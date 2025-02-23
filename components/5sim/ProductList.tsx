import { useEffect, useState } from 'react';
import { getProducts } from '@/lib/5simService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const ProductList = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getProducts();
        if (data) {
          setProducts(data);
        } else {
          setError('Failed to fetch products.');
          toast.error('Failed to fetch products.');
        }
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred.');
        toast.error(e.message || 'An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product List</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Badge variant="secondary">Loading...</Badge>
        ) : error ? (
          <Badge variant="destructive">{error}</Badge>
        ) : (
          <div className="grid gap-2">
            {products.map((product) => (
              <div key={product.id} className="border rounded-md p-2">
                <Badge variant="outline">{product.name}</Badge> - Price: ${product.Price}, Quantity: {product.Qty}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductList; 