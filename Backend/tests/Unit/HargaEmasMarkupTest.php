<?php

namespace Tests\Unit;

use App\Models\HargaEmasHarian;
use PHPUnit\Framework\TestCase;

class HargaEmasMarkupTest extends TestCase
{
    public function test_markup_per_gram_berdasarkan_tier_gramasi(): void
    {
        $this->assertEquals(HargaEmasHarian::MARKUP_1_5_GRAM, HargaEmasHarian::markupPerGram(0.5));
        $this->assertEquals(HargaEmasHarian::MARKUP_1_5_GRAM, HargaEmasHarian::markupPerGram(5));
        $this->assertEquals(HargaEmasHarian::MARKUP_6_10_GRAM, HargaEmasHarian::markupPerGram(5.0001));
        $this->assertEquals(HargaEmasHarian::MARKUP_6_10_GRAM, HargaEmasHarian::markupPerGram(10));
        $this->assertEquals(HargaEmasHarian::MARKUP_11_GRAM_PLUS, HargaEmasHarian::markupPerGram(10.0001));
        $this->assertEquals(HargaEmasHarian::MARKUP_11_GRAM_PLUS, HargaEmasHarian::markupPerGram(25));
    }

    public function test_harga_jual_per_gram_menambahkan_markup(): void
    {
        $harga = new HargaEmasHarian(['harga_per_gram' => 1000000]);
        $this->assertEquals(1200000.0, $harga->hargaJualPerGram(2));
        $this->assertEquals(1150000.0, $harga->hargaJualPerGram(6));
        $this->assertEquals(1100000.0, $harga->hargaJualPerGram(15));
    }
}