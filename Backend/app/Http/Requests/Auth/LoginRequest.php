<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Bisa berupa: username atau nomor anggota (10 digit)
            'username' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ];
    }
}
